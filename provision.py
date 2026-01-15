#!/usr/bin/env python3
"""
Tenant Provisioning Script for FinanceTracker SaaS

This script handles creating and managing Docker containers for each tenant.
Each tenant gets their own isolated container with their own database.
"""

import os
import sys
import time
import secrets
import sqlite3
import subprocess
import json

# Configuration
SAAS_DOMAIN = os.environ.get('SAAS_DOMAIN', 'financetracker.app')
DOCKER_NETWORK = 'ledger-categorize_saas_network'
IMAGE_NAME = 'financetracker:latest'
BASE_PORT = 10000  # Tenant ports start from here


def get_saas_db():
    """Connect to SaaS management database."""
    conn = sqlite3.connect('saas.db')
    conn.row_factory = sqlite3.Row
    return conn


def get_next_port(db):
    """Get next available port for tenant container."""
    result = db.execute('SELECT MAX(port) as max_port FROM tenant_instances').fetchone()
    max_port = result['max_port'] if result['max_port'] else BASE_PORT - 1
    return max_port + 1


def provision_tenant(tenant_id: int):
    """
    Provision a new Docker container for a tenant.

    Args:
        tenant_id: The tenant's ID in the database
    """
    db = get_saas_db()

    # Get tenant info
    tenant = db.execute('SELECT * FROM tenants WHERE id = ?', (tenant_id,)).fetchone()
    if not tenant:
        print(f"Error: Tenant {tenant_id} not found")
        return False

    subdomain = tenant['subdomain']
    print(f"Provisioning container for tenant: {subdomain}")

    # Check if already provisioned
    existing = db.execute(
        'SELECT * FROM tenant_instances WHERE tenant_id = ?', (tenant_id,)
    ).fetchone()

    if existing and existing['status'] == 'running':
        print(f"Tenant {subdomain} already has a running container")
        return True

    # Get next available port
    port = get_next_port(db)

    # Generate secure secret key for this tenant
    secret_key = secrets.token_hex(32)

    # Container name
    container_name = f"ft-tenant-{subdomain}"

    # Create data directory for tenant
    data_dir = f"/var/lib/financetracker/tenants/{subdomain}"
    os.makedirs(data_dir, exist_ok=True)

    # Docker run command
    docker_cmd = [
        'docker', 'run', '-d',
        '--name', container_name,
        '--restart', 'unless-stopped',
        '--network', DOCKER_NETWORK,
        '-v', f'{data_dir}:/data',
        '-e', f'SECRET_KEY={secret_key}',
        '-e', 'DATABASE=/data/finance.db',
        '-e', 'FLASK_ENV=production',
        '-l', 'traefik.enable=true',
        '-l', f'traefik.http.routers.{subdomain}.rule=Host(`{subdomain}.{SAAS_DOMAIN}`)',
        '-l', f'traefik.http.routers.{subdomain}.entrypoints=websecure',
        '-l', f'traefik.http.routers.{subdomain}.tls.certresolver=letsencrypt',
        '-l', f'traefik.http.services.{subdomain}.loadbalancer.server.port=8000',
        IMAGE_NAME
    ]

    try:
        # Run container
        result = subprocess.run(docker_cmd, capture_output=True, text=True, check=True)
        container_id = result.stdout.strip()

        # Save to database
        if existing:
            db.execute('''
                UPDATE tenant_instances SET
                    container_id = ?,
                    port = ?,
                    status = 'running'
                WHERE tenant_id = ?
            ''', (container_id, port, tenant_id))
        else:
            db.execute('''
                INSERT INTO tenant_instances (tenant_id, container_id, port, status)
                VALUES (?, ?, ?, 'running')
            ''', (tenant_id, container_id, port))

        db.commit()
        print(f"Successfully provisioned container {container_id[:12]} for {subdomain}")
        print(f"Available at: https://{subdomain}.{SAAS_DOMAIN}")
        return True

    except subprocess.CalledProcessError as e:
        print(f"Error provisioning container: {e.stderr}")

        # Save failed status
        if existing:
            db.execute(
                'UPDATE tenant_instances SET status = ? WHERE tenant_id = ?',
                ('failed', tenant_id)
            )
        else:
            db.execute(
                'INSERT INTO tenant_instances (tenant_id, status) VALUES (?, ?)',
                (tenant_id, 'failed')
            )
        db.commit()
        return False


def stop_tenant(tenant_id: int):
    """Stop a tenant's container."""
    db = get_saas_db()

    instance = db.execute(
        'SELECT * FROM tenant_instances WHERE tenant_id = ?', (tenant_id,)
    ).fetchone()

    if not instance or not instance['container_id']:
        print(f"No container found for tenant {tenant_id}")
        return False

    container_id = instance['container_id']

    try:
        subprocess.run(['docker', 'stop', container_id], check=True, capture_output=True)
        db.execute(
            'UPDATE tenant_instances SET status = ? WHERE tenant_id = ?',
            ('stopped', tenant_id)
        )
        db.commit()
        print(f"Stopped container {container_id[:12]}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error stopping container: {e}")
        return False


def remove_tenant(tenant_id: int):
    """Remove a tenant's container and data."""
    db = get_saas_db()

    tenant = db.execute('SELECT * FROM tenants WHERE id = ?', (tenant_id,)).fetchone()
    instance = db.execute(
        'SELECT * FROM tenant_instances WHERE tenant_id = ?', (tenant_id,)
    ).fetchone()

    if instance and instance['container_id']:
        try:
            # Stop and remove container
            subprocess.run(['docker', 'stop', instance['container_id']], capture_output=True)
            subprocess.run(['docker', 'rm', instance['container_id']], capture_output=True)
        except Exception as e:
            print(f"Warning: Error removing container: {e}")

    # Remove from database
    db.execute('DELETE FROM tenant_instances WHERE tenant_id = ?', (tenant_id,))
    db.commit()

    print(f"Removed tenant {tenant_id} container")

    if tenant:
        # Optionally remove data directory
        data_dir = f"/var/lib/financetracker/tenants/{tenant['subdomain']}"
        if os.path.exists(data_dir):
            print(f"Data directory preserved at: {data_dir}")
            print("Remove manually if needed: rm -rf", data_dir)

    return True


def list_tenants():
    """List all tenants and their container status."""
    db = get_saas_db()

    tenants = db.execute('''
        SELECT t.*, ti.container_id, ti.port, ti.status as instance_status
        FROM tenants t
        LEFT JOIN tenant_instances ti ON t.id = ti.tenant_id
        ORDER BY t.created_at DESC
    ''').fetchall()

    if not tenants:
        print("No tenants found")
        return

    print(f"{'ID':<5} {'Subdomain':<20} {'Plan':<15} {'Status':<12} {'Container':<15}")
    print("-" * 70)

    for t in tenants:
        container = t['container_id'][:12] if t['container_id'] else 'N/A'
        print(f"{t['id']:<5} {t['subdomain']:<20} {t['plan'] or 'trial':<15} "
              f"{t['instance_status'] or 'none':<12} {container:<15}")


def provision_all_pending():
    """Provision containers for all tenants without running containers."""
    db = get_saas_db()

    pending = db.execute('''
        SELECT t.id FROM tenants t
        LEFT JOIN tenant_instances ti ON t.id = ti.tenant_id
        WHERE ti.id IS NULL OR ti.status != 'running'
    ''').fetchall()

    if not pending:
        print("No pending tenants to provision")
        return

    print(f"Found {len(pending)} tenants to provision")

    for tenant in pending:
        provision_tenant(tenant['id'])
        time.sleep(2)  # Small delay between provisions


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python provision.py list                    - List all tenants")
        print("  python provision.py provision <tenant_id>   - Provision a tenant")
        print("  python provision.py provision-all           - Provision all pending")
        print("  python provision.py stop <tenant_id>        - Stop a tenant")
        print("  python provision.py remove <tenant_id>      - Remove a tenant")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'list':
        list_tenants()
    elif command == 'provision' and len(sys.argv) > 2:
        provision_tenant(int(sys.argv[2]))
    elif command == 'provision-all':
        provision_all_pending()
    elif command == 'stop' and len(sys.argv) > 2:
        stop_tenant(int(sys.argv[2]))
    elif command == 'remove' and len(sys.argv) > 2:
        remove_tenant(int(sys.argv[2]))
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
