# FinanceTracker Server Installation Guide

## Local Development

**Requirements:** Python 3.9+

```bash
git clone https://github.com/youruser/financetracker.git
cd financetracker
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The app will be available at `http://localhost:5000`. Register your first user account to get started. The SQLite database is created automatically at `finance.db` in the project root.

## Docker Self-Hosted

```bash
docker-compose up -d
```

Data is persisted via a Docker volume. To use a bind mount instead, edit `docker-compose.yml` and map a host directory to `/app/data`.

Configure the instance with environment variables in a `.env` file or directly in `docker-compose.yml`:

```yaml
environment:
  - SECRET_KEY=your-random-secret-key
  - DATABASE=/app/data/finance.db
  - REGISTRATION_ENABLED=true
```

## Production Deployment (VPS/Cloud)

### Gunicorn

Install gunicorn in your virtual environment:

```bash
pip install gunicorn
gunicorn -w 4 -b 127.0.0.1:8000 app:app
```

### systemd Service

Create `/etc/systemd/system/financetracker.service`:

```ini
[Unit]
Description=FinanceTracker
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/financetracker
Environment="PATH=/opt/financetracker/venv/bin"
EnvironmentFile=/opt/financetracker/.env
ExecStart=/opt/financetracker/venv/bin/gunicorn -w 4 -b 127.0.0.1:8000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now financetracker
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name finance.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d finance.example.com
```

Certbot will automatically update the nginx config to handle HTTPS and set up auto-renewal.

## SaaS Mode

SaaS mode enables the public landing page at `/`, multi-tenant support, and Stripe billing integration. The landing page is only visible when `SAAS_MODE=true` is set; otherwise, `/` redirects to the login page.

Deploy using the SaaS-specific compose file:

```bash
docker-compose -f docker-compose.saas.yml up -d
```

Required environment variables for SaaS mode:

```bash
SAAS_MODE=true
SAAS_DOMAIN=app.example.com
EMAIL_DOMAIN=example.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Tenant Provisioning

New tenants are provisioned automatically on signup through Stripe, or manually:

```bash
python provision.py --tenant acme --email admin@acme.com
```

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | (generated) | Flask secret key for session signing. Set a strong random value in production. |
| `DATABASE` | `finance.db` | Path to the SQLite database file. |
| `SAAS_MODE` | `false` | Set to `true` to enable the landing page, multi-tenant mode, and Stripe billing. |
| `REGISTRATION_ENABLED` | `true` | Set to `false` to prevent new user signups. |
| `SAAS_DOMAIN` | — | Primary domain for the SaaS instance. |
| `EMAIL_DOMAIN` | — | Domain used for outbound email. |
| `STRIPE_SECRET_KEY` | — | Stripe secret API key (SaaS mode). |
| `STRIPE_PUBLISHABLE_KEY` | — | Stripe publishable API key (SaaS mode). |

## Backup

The entire application state lives in the SQLite database file. To back up:

```bash
cp finance.db finance.db.bak
```

For automated backups, schedule a cron job or use `sqlite3 finance.db ".backup /path/to/backup.db"` for a safe online backup.

## Updating

```bash
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart financetracker
```

For Docker deployments:

```bash
docker-compose down
docker-compose pull
docker-compose up -d
```
