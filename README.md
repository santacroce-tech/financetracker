# FinanceTracker

A simple, powerful personal finance application similar to Quicken and Microsoft Money. Built with Python, Flask, and SQLite.

![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Flask](https://img.shields.io/badge/flask-3.0+-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### Core Features
- **Multi-Account Support** - Track checking, savings, credit cards, cash, and investments
- **Transaction Management** - Add, edit, delete, and search transactions
- **CSV Import** - Import bank statements with automatic format detection (US/European)
- **Category Management** - Custom categories with icons and colors
- **Reports & Charts** - Visual spending analysis, monthly trends, savings rate

### Smart Categorization
- **Auto-Categorization Rules** - Create patterns to automatically categorize transactions
- **Keyboard-Driven Clearing** - Quickly categorize transactions using keyboard shortcuts
- **Category Suggestions** - Smart suggestions based on merchant/payee

### Email Inbox (Forward Receipts)
- **Unique Email Address** - Each user gets an email like `abc123@in.financetracker.app`
- **Auto-Parsing** - Extracts vendor, amount, date from forwarded invoices
- **50+ Vendors Supported** - Airlines, hotels, subscriptions, food delivery, etc.
- **Review & Approve** - Review parsed data before creating transactions

### SaaS Features (Cloud Version)
- **Multi-Tenant Architecture** - Isolated container per customer
- **Stripe Integration** - European payments with SEPA Direct Debit support
- **Custom Subdomains** - Each customer gets `company.financetracker.app`
- **Admin Dashboard** - Manage tenants, view stats, billing

## Quick Start

### Self-Hosted (Local Development)

```bash
# Clone the repository
git clone https://github.com/yourusername/financetracker.git
cd financetracker

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py

# Open http://localhost:5000 in your browser
```

### Docker (Self-Hosted)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Open http://localhost:5000
```

### SaaS Mode (Landing Page + Multi-Tenant)

```bash
# Set environment variables
export SAAS_MODE=true
export STRIPE_SECRET_KEY=sk_live_...

# Run the application
python app.py

# Open http://localhost:5000 to see landing page
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Flask secret key | `dev-secret-key...` |
| `DATABASE` | SQLite database path | `finance.db` |
| `SAAS_MODE` | Enable SaaS features | `false` |
| `SAAS_DOMAIN` | Domain for tenant subdomains | `financetracker.app` |
| `EMAIL_DOMAIN` | Domain for email ingestion | `in.financetracker.app` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | - |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | - |

## Project Structure

```
financetracker/
├── app.py                 # Main Flask application
├── saas.py                # SaaS management module
├── email_processor.py     # Email parsing for receipts
├── provision.py           # Docker tenant provisioning
├── requirements.txt       # Python dependencies
├── Dockerfile             # Container image
├── docker-compose.yml     # Self-hosted deployment
├── docker-compose.saas.yml # SaaS infrastructure
├── templates/
│   ├── base.html          # Base template
│   ├── landing.html       # SaaS landing page
│   ├── dashboard.html     # Main dashboard
│   ├── transactions.html  # Transaction list
│   ├── accounts.html      # Account management
│   ├── categories.html    # Category management
│   ├── rules.html         # Auto-categorization rules
│   ├── clear.html         # Keyboard-driven clearing
│   ├── email_inbox.html   # Email receipt inbox
│   ├── reports.html       # Reports & charts
│   ├── import.html        # CSV import
│   └── ...
└── static/
    ├── css/
    └── js/
```

## Usage Guide

### Importing Bank Transactions

1. Export CSV from your bank
2. Go to **Import** in the sidebar
3. Select the account to import into
4. Upload your CSV file
5. The importer auto-detects:
   - Date format (DD/MM/YYYY or YYYY-MM-DD)
   - Number format (1,234.56 or 1.234,56)
   - Delimiter (comma, semicolon, tab)

### Setting Up Email Forwarding

1. Go to **Email** in the sidebar
2. Copy your unique email address
3. Set up email forwarding in Gmail/Outlook:
   - **Gmail**: Settings → Forwarding → Add address
   - **Outlook**: Settings → Mail → Forwarding
4. Or simply forward invoices manually to your inbox email

### Keyboard Shortcuts (Clearing Page)

| Key | Action |
|-----|--------|
| `j` / `↓` | Next transaction |
| `k` / `↑` | Previous transaction |
| `1`-`9` | Select category |
| `Enter` | Apply category |
| `r` | Create rule |
| `s` | Skip |

### Auto-Categorization Rules

1. Go to **Rules** in the sidebar
2. Click **Add Rule**
3. Enter a pattern (e.g., `UBER`, `Amazon`, `NETFLIX`)
4. Select the category
5. Rules are applied during import and email processing

## API Endpoints

### Email Webhook
```
POST /api/email/inbound
```
Receives forwarded emails from SendGrid, Mailgun, or Postmark.

### Transaction API
```
POST /api/transaction/<id>/categorize
POST /api/auto-categorize
```

## Deployment

### Docker Compose (Self-Hosted)

```bash
docker-compose up -d
```

### SaaS with Traefik

```bash
# Configure environment
cp .env.example .env
# Edit .env with your Stripe keys and domain

# Start infrastructure
docker-compose -f docker-compose.saas.yml up -d
```

### Provisioning Tenants

```bash
# List all tenants
python provision.py list

# Provision a tenant container
python provision.py provision <tenant_id>

# Provision all pending
python provision.py provision-all
```

## Pricing Plans (SaaS)

| Plan | Price | Features |
|------|-------|----------|
| **Self-Hosted** | Free | Full source code, Docker ready |
| **Cloud Pro** | €9/month | Own subdomain, backups, SSL, EU data |
| **Cloud Family** | €19/month | Pro + 5 users, custom domain |

## Tech Stack

- **Backend**: Python 3.9+, Flask 3.0+
- **Database**: SQLite
- **Frontend**: Bootstrap 5, Chart.js
- **Payments**: Stripe (with SEPA support)
- **Email**: SendGrid / Mailgun / Postmark
- **Deployment**: Docker, Traefik

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs.financetracker.app](https://docs.financetracker.app)
- **Issues**: [GitHub Issues](https://github.com/yourusername/financetracker/issues)
- **Email**: support@financetracker.app

---

Made with ❤️ in Europe
