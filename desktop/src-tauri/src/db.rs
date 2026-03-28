use rusqlite::{Connection, Result};

pub fn open_database(path: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    initialize_schema(&conn)?;
    Ok(conn)
}

pub fn initialize_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS accounts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            account_type TEXT NOT NULL DEFAULT 'checking',
            balance     REAL NOT NULL DEFAULT 0.0,
            currency    TEXT NOT NULL DEFAULT 'USD',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS categories (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            category_type TEXT NOT NULL DEFAULT 'expense',
            icon          TEXT NOT NULL DEFAULT 'tag',
            color         TEXT NOT NULL DEFAULT '#6c757d',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id       INTEGER NOT NULL REFERENCES accounts(id),
            category_id      INTEGER REFERENCES categories(id),
            transaction_type TEXT NOT NULL DEFAULT 'expense',
            amount           REAL NOT NULL,
            description      TEXT,
            payee            TEXT,
            date             TEXT NOT NULL,
            created_at       TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id),
            amount      REAL NOT NULL,
            period      TEXT NOT NULL DEFAULT 'monthly',
            start_date  TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS category_rules (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id),
            pattern     TEXT NOT NULL,
            match_field TEXT NOT NULL DEFAULT 'description',
            is_regex    INTEGER NOT NULL DEFAULT 0,
            priority    INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        ",
    )?;

    seed_default_categories(conn)?;
    Ok(())
}

fn seed_default_categories(conn: &Connection) -> Result<()> {
    let count: i64 =
        conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;

    if count > 0 {
        return Ok(());
    }

    let defaults = [
        ("Salary", "income", "cash-stack", "#198754"),
        ("Freelance", "income", "laptop", "#20c997"),
        ("Investment", "income", "graph-up-arrow", "#0dcaf0"),
        ("Other Income", "income", "plus-circle", "#6610f2"),
        ("Housing", "expense", "house", "#dc3545"),
        ("Food & Dining", "expense", "egg-fried", "#fd7e14"),
        ("Transportation", "expense", "car-front", "#ffc107"),
        ("Entertainment", "expense", "film", "#6f42c1"),
        ("Healthcare", "expense", "heart-pulse", "#d63384"),
        ("Shopping", "expense", "bag", "#0d6efd"),
        ("Utilities", "expense", "lightning-charge", "#6c757d"),
        ("Subscriptions", "expense", "credit-card-2-front", "#0dcaf0"),
        ("Education", "expense", "book", "#198754"),
        ("Travel", "expense", "airplane", "#fd7e14"),
        ("Personal Care", "expense", "person", "#6610f2"),
        ("Other", "expense", "three-dots", "#adb5bd"),
        ("Transfer", "transfer", "arrow-left-right", "#0d6efd"),
    ];

    for (name, cat_type, icon, color) in &defaults {
        conn.execute(
            "INSERT OR IGNORE INTO categories (name, category_type, icon, color) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![name, cat_type, icon, color],
        )?;
    }

    Ok(())
}
