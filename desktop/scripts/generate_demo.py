#!/usr/bin/env python3
"""Generate a demo SQLite database for the Finance Tracker desktop app."""

import sqlite3
import random
import os
from datetime import datetime, timedelta

random.seed(42)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "resources", "demo.db")
DB_PATH = os.path.abspath(DB_PATH)

# Ensure the directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Remove existing file
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
cur.executescript("""
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category_type TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL,
    category_id INTEGER,
    transaction_type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    payee TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS category_rules (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL,
    pattern TEXT NOT NULL,
    match_field TEXT NOT NULL DEFAULT 'description',
    is_regex INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
""")

# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
accounts = [
    (1, "Checking",    "checking", 5420.50,   "USD"),
    (2, "Savings",     "savings",  12350.00,  "USD"),
    (3, "Credit Card", "credit",   -1245.80,  "USD"),
    (4, "Cash Wallet", "cash",     340.00,    "USD"),
]
cur.executemany(
    "INSERT INTO accounts (id, name, account_type, balance, currency) VALUES (?, ?, ?, ?, ?)",
    accounts,
)

# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
categories = [
    # Income
    (1,  "Salary",        "income",  "bi-briefcase",      "#198754"),
    (2,  "Freelance",     "income",  "bi-laptop",         "#0d6efd"),
    (3,  "Investments",   "income",  "bi-graph-up-arrow", "#6f42c1"),
    (4,  "Other Income",  "income",  "bi-three-dots",     "#6c757d"),
    # Expense
    (5,  "Housing",       "expense", "bi-house",          "#dc3545"),
    (6,  "Groceries",     "expense", "bi-cart",           "#198754"),
    (7,  "Transportation","expense", "bi-car-front",      "#fd7e14"),
    (8,  "Utilities",     "expense", "bi-lightning",      "#ffc107"),
    (9,  "Dining Out",    "expense", "bi-cup-hot",        "#0d6efd"),
    (10, "Entertainment", "expense", "bi-film",           "#6f42c1"),
    (11, "Healthcare",    "expense", "bi-heart-pulse",    "#dc3545"),
    (12, "Shopping",      "expense", "bi-bag",            "#e91e8f"),
    (13, "Insurance",     "expense", "bi-shield-check",   "#0dcaf0"),
    (14, "Education",     "expense", "bi-book",           "#198754"),
    (15, "Personal Care", "expense", "bi-person",         "#fd7e14"),
    (16, "Subscriptions", "expense", "bi-repeat",         "#6c757d"),
    (17, "Travel",        "expense", "bi-airplane",       "#0d6efd"),
]
cur.executemany(
    "INSERT INTO categories (id, name, category_type, icon, color) VALUES (?, ?, ?, ?, ?)",
    categories,
)

# ---------------------------------------------------------------------------
# Helper: random date in a given month
# ---------------------------------------------------------------------------
def random_date_in_month(year: int, month: int) -> str:
    """Return a random date string (YYYY-MM-DD) within the given month."""
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1)
    else:
        next_month_start = datetime(year, month + 1, 1)
    month_start = datetime(year, month, 1)
    days_in_month = (next_month_start - month_start).days
    day = random.randint(1, days_in_month)
    return f"{year}-{month:02d}-{day:02d}"


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
transactions = []  # (account_id, category_id, transaction_type, amount, description, payee, date)

# Category IDs for reference
CAT_SALARY = 1
CAT_FREELANCE = 2
CAT_HOUSING = 5
CAT_GROCERIES = 6
CAT_TRANSPORT = 7
CAT_UTILITIES = 8
CAT_DINING = 9
CAT_ENTERTAINMENT = 10
CAT_HEALTHCARE = 11
CAT_SHOPPING = 12
CAT_SUBSCRIPTIONS = 16

grocery_payees = ["Whole Foods", "Trader Joe's", "Costco", "Safeway"]
dining_payees = ["Chipotle", "Starbucks", "Pizza Hut", "Local Bistro"]
utility_payees = ["PG&E", "AT&T", "Comcast"]
transport_payees = ["Shell Gas", "Uber", "BART"]
entertainment_payees = ["Netflix", "Spotify", "AMC Theaters"]
shopping_payees = ["Amazon", "Target", "Best Buy"]

months = [
    (2025, 10), (2025, 11), (2025, 12),
    (2026, 1), (2026, 2), (2026, 3),
]

uncategorized_indices = set()

for year, month in months:
    # Salary - 1st of each month
    transactions.append((1, CAT_SALARY, "income", 4500.00, "Monthly salary", "Acme Corp", f"{year}-{month:02d}-01"))

    # Freelance - occasional (roughly every other month)
    if random.random() < 0.6:
        amt = round(random.uniform(500, 1500), 2)
        transactions.append((1, CAT_FREELANCE, "income", amt, "Freelance project", "Client Project", random_date_in_month(year, month)))

    # Rent - 1st of each month
    transactions.append((1, CAT_HOUSING, "expense", 1800.00, "Monthly rent", "Rent Payment", f"{year}-{month:02d}-01"))

    # Groceries - 8 to 12 per month
    for _ in range(random.randint(8, 12)):
        amt = round(random.uniform(25, 120), 2)
        payee = random.choice(grocery_payees)
        transactions.append((1, CAT_GROCERIES, "expense", amt, "Groceries", payee, random_date_in_month(year, month)))

    # Dining - 5 to 7 per month
    for _ in range(random.randint(5, 7)):
        amt = round(random.uniform(15, 75), 2)
        payee = random.choice(dining_payees)
        transactions.append((1, CAT_DINING, "expense", amt, "Dining out", payee, random_date_in_month(year, month)))

    # Utilities - 1 to 3 per month
    for payee in random.sample(utility_payees, k=random.randint(1, 3)):
        amt = round(random.uniform(80, 200), 2)
        transactions.append((1, CAT_UTILITIES, "expense", amt, "Utility bill", payee, random_date_in_month(year, month)))

    # Transportation - 3 to 5 per month
    for _ in range(random.randint(3, 5)):
        amt = round(random.uniform(10, 80), 2)
        payee = random.choice(transport_payees)
        transactions.append((1, CAT_TRANSPORT, "expense", amt, "Transport", payee, random_date_in_month(year, month)))

    # Entertainment - 2 to 4 per month
    for _ in range(random.randint(2, 4)):
        amt = round(random.uniform(10, 50), 2)
        payee = random.choice(entertainment_payees)
        transactions.append((1, CAT_ENTERTAINMENT, "expense", amt, "Entertainment", payee, random_date_in_month(year, month)))

    # Shopping - 2 to 3 per month (some on credit card)
    for _ in range(random.randint(2, 3)):
        amt = round(random.uniform(20, 200), 2)
        payee = random.choice(shopping_payees)
        acct = random.choice([1, 3])  # Checking or Credit Card
        transactions.append((acct, CAT_SHOPPING, "expense", amt, "Shopping", payee, random_date_in_month(year, month)))

    # Healthcare - occasional
    if random.random() < 0.5:
        amt = round(random.uniform(20, 150), 2)
        transactions.append((1, CAT_HEALTHCARE, "expense", amt, "Medical expense", "City Clinic", random_date_in_month(year, month)))

# Pick ~15 random transactions to make uncategorized (NULL category_id)
all_indices = list(range(len(transactions)))
# Avoid making salary, rent, or freelance uncategorized (those are the first few each month block)
eligible = [i for i in all_indices if transactions[i][3] < 3000 and transactions[i][2] == "expense"]
uncategorized_indices = set(random.sample(eligible, min(15, len(eligible))))

# Insert transactions
for idx, (account_id, category_id, txn_type, amount, description, payee, date) in enumerate(transactions):
    cat = None if idx in uncategorized_indices else category_id
    cur.execute(
        "INSERT INTO transactions (account_id, category_id, transaction_type, amount, description, payee, date) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (account_id, cat, txn_type, amount, description, payee, date),
    )

# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------
budgets = [
    (CAT_GROCERIES,     600.00,  "monthly", "2025-10-01"),
    (CAT_DINING,        300.00,  "monthly", "2025-10-01"),
    (CAT_ENTERTAINMENT, 150.00,  "monthly", "2025-10-01"),
    (CAT_SHOPPING,      400.00,  "monthly", "2025-10-01"),
]
cur.executemany(
    "INSERT INTO budgets (category_id, amount, period, start_date) VALUES (?, ?, ?, ?)",
    budgets,
)

# ---------------------------------------------------------------------------
# Category Rules
# ---------------------------------------------------------------------------
rules = [
    (CAT_SALARY,        "salary|payroll",                                   "description", 1, 10),
    (CAT_GROCERIES,     "whole foods|trader joe|costco|safeway|grocery",    "description", 1, 5),
    (CAT_SUBSCRIPTIONS, "netflix|spotify|hulu|disney",                      "description", 1, 5),
    (CAT_TRANSPORT,     "uber|lyft|bart|shell gas",                         "description", 1, 5),
    (CAT_SHOPPING,      "amazon",                                           "description", 0, 0),
]
cur.executemany(
    "INSERT INTO category_rules (category_id, pattern, match_field, is_regex, priority) VALUES (?, ?, ?, ?, ?)",
    rules,
)

conn.commit()
conn.close()

print(f"Demo database created at: {DB_PATH}")
print(f"Total transactions generated: {len(transactions)}")
print(f"Uncategorized transactions: {len(uncategorized_indices)}")
