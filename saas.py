"""
SaaS Management Module for FinanceTracker

This module handles:
- Tenant (customer) management
- Stripe payment integration
- Subdomain routing
- Cloud instance provisioning
"""

import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta
from functools import wraps

from flask import Blueprint, render_template, request, redirect, url_for, flash, g, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash

# Try to import Stripe (optional dependency)
try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    stripe = None

saas_bp = Blueprint('saas', __name__)

# Configuration
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
SAAS_DOMAIN = os.environ.get('SAAS_DOMAIN', 'financetracker.app')

# Stripe Price IDs (create these in your Stripe Dashboard)
PRICE_IDS = {
    'pro_monthly': os.environ.get('STRIPE_PRICE_PRO_MONTHLY', 'price_pro_monthly'),
    'pro_yearly': os.environ.get('STRIPE_PRICE_PRO_YEARLY', 'price_pro_yearly'),
    'family_monthly': os.environ.get('STRIPE_PRICE_FAMILY_MONTHLY', 'price_family_monthly'),
    'family_yearly': os.environ.get('STRIPE_PRICE_FAMILY_YEARLY', 'price_family_yearly'),
}

if STRIPE_AVAILABLE and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def get_saas_db():
    """Get connection to the SaaS management database."""
    if 'saas_db' not in g:
        g.saas_db = sqlite3.connect('saas.db')
        g.saas_db.row_factory = sqlite3.Row
    return g.saas_db


def init_saas_db():
    """Initialize the SaaS management database."""
    db = get_saas_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subdomain TEXT UNIQUE NOT NULL,
            company_name TEXT,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            plan TEXT DEFAULT 'trial',
            status TEXT DEFAULT 'active',
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT,
            trial_ends_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tenant_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants (id),
            UNIQUE(tenant_id, email)
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            stripe_invoice_id TEXT,
            amount INTEGER NOT NULL,
            currency TEXT DEFAULT 'eur',
            status TEXT DEFAULT 'pending',
            invoice_pdf TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants (id)
        );

        CREATE TABLE IF NOT EXISTS tenant_instances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            container_id TEXT,
            port INTEGER,
            status TEXT DEFAULT 'provisioning',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants (id)
        );
    ''')
    db.commit()


def validate_subdomain(subdomain):
    """Validate subdomain format."""
    if not subdomain:
        return False, "Subdomain is required"
    if len(subdomain) < 3:
        return False, "Subdomain must be at least 3 characters"
    if len(subdomain) > 30:
        return False, "Subdomain must be less than 30 characters"
    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', subdomain) and len(subdomain) > 2:
        return False, "Subdomain can only contain lowercase letters, numbers, and hyphens"
    if subdomain in ['www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'ssh', 'blog', 'help', 'support']:
        return False, "This subdomain is reserved"
    return True, None


# Landing page route
@saas_bp.route('/')
def landing():
    return render_template('landing.html')


# Cloud signup
@saas_bp.route('/signup', methods=['GET', 'POST'])
def signup_cloud():
    if request.method == 'POST':
        subdomain = request.form.get('subdomain', '').strip().lower()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        company_name = request.form.get('company_name', '').strip()
        plan = request.form.get('plan', 'pro')

        # Validate subdomain
        valid, error = validate_subdomain(subdomain)
        if not valid:
            flash(error, 'danger')
            return render_template('signup_cloud.html', plan=plan)

        # Validate email
        if not email or '@' not in email:
            flash('Valid email is required', 'danger')
            return render_template('signup_cloud.html', plan=plan)

        # Validate password
        if len(password) < 8:
            flash('Password must be at least 8 characters', 'danger')
            return render_template('signup_cloud.html', plan=plan)

        db = get_saas_db()

        # Check if subdomain exists
        existing = db.execute('SELECT id FROM tenants WHERE subdomain = ?', (subdomain,)).fetchone()
        if existing:
            flash('This subdomain is already taken', 'danger')
            return render_template('signup_cloud.html', plan=plan)

        # Check if email exists
        existing_email = db.execute('SELECT id FROM tenants WHERE email = ?', (email,)).fetchone()
        if existing_email:
            flash('An account with this email already exists', 'danger')
            return render_template('signup_cloud.html', plan=plan)

        # Create Stripe customer if available
        stripe_customer_id = None
        if STRIPE_AVAILABLE and STRIPE_SECRET_KEY:
            try:
                customer = stripe.Customer.create(
                    email=email,
                    name=company_name or subdomain,
                    metadata={'subdomain': subdomain}
                )
                stripe_customer_id = customer.id
            except Exception as e:
                current_app.logger.error(f"Stripe customer creation failed: {e}")

        # Create tenant
        trial_ends = datetime.now() + timedelta(days=14)
        password_hash = generate_password_hash(password, method='pbkdf2:sha256')

        cursor = db.execute('''
            INSERT INTO tenants (subdomain, company_name, email, password_hash, plan, stripe_customer_id, trial_ends_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (subdomain, company_name, email, password_hash, f'{plan}_trial', stripe_customer_id, trial_ends))
        tenant_id = cursor.lastrowid
        db.commit()

        # TODO: Provision Docker container for tenant
        # provision_tenant_instance(tenant_id, subdomain)

        flash(f'Account created! Your finance tracker is available at https://{subdomain}.{SAAS_DOMAIN}', 'success')

        # If Stripe is available, redirect to checkout for paid plan
        if STRIPE_AVAILABLE and STRIPE_SECRET_KEY and plan in ['pro', 'family']:
            return redirect(url_for('saas.checkout', tenant_id=tenant_id, plan=plan))

        return redirect(url_for('saas.signup_success', subdomain=subdomain))

    plan = request.args.get('plan', 'pro')
    return render_template('signup_cloud.html', plan=plan)


@saas_bp.route('/signup/success')
def signup_success():
    subdomain = request.args.get('subdomain', '')
    return render_template('signup_success.html', subdomain=subdomain, domain=SAAS_DOMAIN)


# Stripe Checkout
@saas_bp.route('/checkout/<int:tenant_id>')
def checkout(tenant_id):
    plan = request.args.get('plan', 'pro')
    billing = request.args.get('billing', 'monthly')

    if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
        flash('Payment system is not configured', 'warning')
        return redirect(url_for('saas.landing'))

    db = get_saas_db()
    tenant = db.execute('SELECT * FROM tenants WHERE id = ?', (tenant_id,)).fetchone()

    if not tenant:
        flash('Account not found', 'danger')
        return redirect(url_for('saas.landing'))

    price_key = f'{plan}_{billing}'
    price_id = PRICE_IDS.get(price_key)

    if not price_id:
        flash('Invalid plan selected', 'danger')
        return redirect(url_for('saas.landing'))

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=tenant['stripe_customer_id'],
            payment_method_types=['card', 'sepa_debit'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=url_for('saas.checkout_success', _external=True) + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=url_for('saas.checkout_cancel', _external=True),
            metadata={
                'tenant_id': tenant_id,
                'plan': plan
            },
            subscription_data={
                'trial_period_days': 14,
                'metadata': {
                    'tenant_id': tenant_id,
                    'plan': plan
                }
            },
            # European-specific options
            billing_address_collection='required',
            tax_id_collection={'enabled': True},
        )
        return redirect(checkout_session.url)
    except Exception as e:
        current_app.logger.error(f"Stripe checkout error: {e}")
        flash('Unable to create checkout session. Please try again.', 'danger')
        return redirect(url_for('saas.landing'))


@saas_bp.route('/checkout/success')
def checkout_success():
    session_id = request.args.get('session_id')
    if session_id and STRIPE_AVAILABLE:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            # Update tenant with subscription info
            db = get_saas_db()
            db.execute('''
                UPDATE tenants SET
                    stripe_subscription_id = ?,
                    plan = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE stripe_customer_id = ?
            ''', (session.subscription, session.metadata.get('plan', 'pro'), session.customer))
            db.commit()
        except Exception as e:
            current_app.logger.error(f"Error updating subscription: {e}")

    return render_template('checkout_success.html')


@saas_bp.route('/checkout/cancel')
def checkout_cancel():
    flash('Checkout was cancelled. You can still use your trial.', 'info')
    return redirect(url_for('saas.landing'))


# Stripe Webhook
@saas_bp.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    if not STRIPE_AVAILABLE:
        return jsonify({'error': 'Stripe not configured'}), 400

    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({'error': 'Invalid signature'}), 400

    db = get_saas_db()

    # Handle events
    if event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        db.execute('''
            UPDATE tenants SET
                plan = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ?
        ''', (
            subscription['metadata'].get('plan', 'pro'),
            'active' if subscription['status'] == 'active' else 'past_due',
            subscription['id']
        ))
        db.commit()

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        db.execute('''
            UPDATE tenants SET
                status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ?
        ''', (subscription['id'],))
        db.commit()

    elif event['type'] == 'invoice.paid':
        invoice = event['data']['object']
        tenant = db.execute(
            'SELECT id FROM tenants WHERE stripe_customer_id = ?',
            (invoice['customer'],)
        ).fetchone()

        if tenant:
            db.execute('''
                INSERT INTO invoices (tenant_id, stripe_invoice_id, amount, currency, status, invoice_pdf)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                tenant['id'],
                invoice['id'],
                invoice['amount_paid'],
                invoice['currency'],
                'paid',
                invoice.get('invoice_pdf')
            ))
            db.commit()

    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        db.execute('''
            UPDATE tenants SET
                status = 'past_due',
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
        ''', (invoice['customer'],))
        db.commit()

    return jsonify({'status': 'success'})


# Customer Portal (for managing subscription)
@saas_bp.route('/portal/<int:tenant_id>')
def customer_portal(tenant_id):
    if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
        flash('Payment system is not configured', 'warning')
        return redirect(url_for('saas.landing'))

    db = get_saas_db()
    tenant = db.execute('SELECT * FROM tenants WHERE id = ?', (tenant_id,)).fetchone()

    if not tenant or not tenant['stripe_customer_id']:
        flash('Account not found', 'danger')
        return redirect(url_for('saas.landing'))

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=tenant['stripe_customer_id'],
            return_url=url_for('saas.landing', _external=True),
        )
        return redirect(portal_session.url)
    except Exception as e:
        current_app.logger.error(f"Portal session error: {e}")
        flash('Unable to open billing portal', 'danger')
        return redirect(url_for('saas.landing'))


# Admin routes (protect these in production!)
@saas_bp.route('/admin')
def admin_dashboard():
    db = get_saas_db()
    tenants = db.execute('''
        SELECT t.*, ti.status as instance_status, ti.container_id
        FROM tenants t
        LEFT JOIN tenant_instances ti ON t.id = ti.tenant_id
        ORDER BY t.created_at DESC
    ''').fetchall()

    stats = {
        'total_tenants': len(tenants),
        'active_trials': len([t for t in tenants if 'trial' in (t['plan'] or '')]),
        'paying_customers': len([t for t in tenants if t['stripe_subscription_id'] and 'trial' not in (t['plan'] or '')]),
    }

    return render_template('admin_dashboard.html', tenants=tenants, stats=stats)


# Close database connection
@saas_bp.teardown_app_request
def close_saas_db(exception):
    db = g.pop('saas_db', None)
    if db is not None:
        db.close()
