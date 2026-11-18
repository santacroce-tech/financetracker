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
    pub owner: String,
    pub created_at: String,
}

const ACCOUNT_COLUMNS: &str = "id, name, account_type, balance, currency, owner, created_at";

fn row_to_account(row: &rusqlite::Row) -> rusqlite::Result<Account> {
    Ok(Account {
        id: row.get(0)?,
        name: row.get(1)?,
        account_type: row.get(2)?,
        balance: row.get(3)?,
        currency: row.get(4)?,
        owner: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn normalize_owner(owner: Option<String>) -> Result<String, String> {
    match owner.as_deref() {
        None | Some("") | Some("personal") => Ok("personal".into()),
        Some("company") => Ok("company".into()),
        Some(o) => Err(format!(
            "Invalid owner '{}': expected 'personal' or 'company'",
            o
        )),
    }
}

#[tauri::command]
pub fn get_accounts(state: tauri::State<AppState>) -> Result<Vec<Account>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM accounts ORDER BY name",
            ACCOUNT_COLUMNS
        ))
        .map_err(|e| e.to_string())?;

    let accounts = stmt
        .query_map([], row_to_account)
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
    owner: Option<String>,
) -> Result<Account, String> {
    let owner = normalize_owner(owner)?;
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO accounts (name, account_type, balance, currency, owner) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![name, account_type, balance, currency, owner],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let account = conn
        .query_row(
            &format!("SELECT {} FROM accounts WHERE id = ?1", ACCOUNT_COLUMNS),
            params![id],
            row_to_account,
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
    owner: Option<String>,
) -> Result<Account, String> {
    let owner = normalize_owner(owner)?;
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE accounts SET name=?1, account_type=?2, balance=?3, currency=?4, owner=?5 WHERE id=?6",
        params![name, account_type, balance, currency, owner, id],
    )
    .map_err(|e| e.to_string())?;

    let account = conn
        .query_row(
            &format!("SELECT {} FROM accounts WHERE id = ?1", ACCOUNT_COLUMNS),
            params![id],
            row_to_account,
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
