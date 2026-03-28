use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: i64,
    pub name: String,
    pub account_type: String,
    pub balance: f64,
    pub currency: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_accounts(state: tauri::State<AppState>) -> Result<Vec<Account>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare("SELECT id, name, account_type, balance, currency, created_at FROM accounts ORDER BY name")
        .map_err(|e| e.to_string())?;

    let accounts = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                balance: row.get(3)?,
                currency: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(accounts)
}

#[tauri::command]
pub fn add_account(
    state: tauri::State<AppState>,
    name: String,
    account_type: String,
    balance: f64,
    currency: String,
) -> Result<Account, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO accounts (name, account_type, balance, currency) VALUES (?1, ?2, ?3, ?4)",
        params![name, account_type, balance, currency],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let account = conn
        .query_row(
            "SELECT id, name, account_type, balance, currency, created_at FROM accounts WHERE id = ?1",
            params![id],
            |row| {
                Ok(Account {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    account_type: row.get(2)?,
                    balance: row.get(3)?,
                    currency: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(account)
}

#[tauri::command]
pub fn update_account(
    state: tauri::State<AppState>,
    id: i64,
    name: String,
    account_type: String,
    balance: f64,
    currency: String,
) -> Result<Account, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE accounts SET name=?1, account_type=?2, balance=?3, currency=?4 WHERE id=?5",
        params![name, account_type, balance, currency, id],
    )
    .map_err(|e| e.to_string())?;

    let account = conn
        .query_row(
            "SELECT id, name, account_type, balance, currency, created_at FROM accounts WHERE id = ?1",
            params![id],
            |row| {
                Ok(Account {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    account_type: row.get(2)?,
                    balance: row.get(3)?,
                    currency: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(account)
}

#[tauri::command]
pub fn delete_account(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute("DELETE FROM accounts WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}
