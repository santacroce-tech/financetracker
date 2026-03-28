use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub id: i64,
    pub account_id: i64,
    pub account_name: Option<String>,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub category_icon: Option<String>,
    pub transaction_type: String,
    pub amount: f64,
    pub description: Option<String>,
    pub payee: Option<String>,
    pub date: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct TransactionFilter {
    pub account_id: Option<i64>,
    pub category_id: Option<i64>,
    pub transaction_type: Option<String>,
    pub search: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn get_transactions(
    state: tauri::State<AppState>,
    filter: Option<TransactionFilter>,
) -> Result<Vec<Transaction>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut sql = String::from(
        "SELECT t.id, t.account_id, a.name, t.category_id, c.name, c.color, c.icon,
                t.transaction_type, t.amount, t.description, t.payee, t.date, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE 1=1",
    );

    let mut conditions: Vec<String> = Vec::new();

    if let Some(ref f) = filter {
        if let Some(aid) = f.account_id {
            conditions.push(format!("t.account_id = {}", aid));
        }
        if let Some(cid) = f.category_id {
            conditions.push(format!("t.category_id = {}", cid));
        }
        if let Some(ref tt) = f.transaction_type {
            conditions.push(format!("t.transaction_type = '{}'", tt.replace('\'', "''")));
        }
        if let Some(ref s) = f.search {
            let escaped = s.replace('\'', "''");
            conditions.push(format!(
                "(t.description LIKE '%{}%' OR t.payee LIKE '%{}%')",
                escaped, escaped
            ));
        }
        if let Some(ref df) = f.date_from {
            conditions.push(format!("t.date >= '{}'", df.replace('\'', "''")));
        }
        if let Some(ref dt) = f.date_to {
            conditions.push(format!("t.date <= '{}'", dt.replace('\'', "''")));
        }
    }

    for cond in &conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }

    sql.push_str(" ORDER BY t.date DESC, t.id DESC");

    if let Some(ref f) = filter {
        if let Some(limit) = f.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }
        if let Some(offset) = f.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let transactions = stmt
        .query_map([], |row| {
            Ok(Transaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                account_name: row.get(2)?,
                category_id: row.get(3)?,
                category_name: row.get(4)?,
                category_color: row.get(5)?,
                category_icon: row.get(6)?,
                transaction_type: row.get(7)?,
                amount: row.get(8)?,
                description: row.get(9)?,
                payee: row.get(10)?,
                date: row.get(11)?,
                created_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(transactions)
}

#[tauri::command]
pub fn add_transaction(
    state: tauri::State<AppState>,
    account_id: i64,
    category_id: Option<i64>,
    transaction_type: String,
    amount: f64,
    description: Option<String>,
    payee: Option<String>,
    date: String,
) -> Result<Transaction, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO transactions (account_id, category_id, transaction_type, amount, description, payee, date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![account_id, category_id, transaction_type, amount, description, payee, date],
    )
    .map_err(|e| e.to_string())?;

    // Update account balance
    let delta = match transaction_type.as_str() {
        "income" => amount,
        "expense" => -amount,
        _ => 0.0,
    };
    if delta != 0.0 {
        conn.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![delta, account_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let id = conn.last_insert_rowid();
    fetch_transaction(conn, id)
}

#[tauri::command]
pub fn update_transaction(
    state: tauri::State<AppState>,
    id: i64,
    account_id: i64,
    category_id: Option<i64>,
    transaction_type: String,
    amount: f64,
    description: Option<String>,
    payee: Option<String>,
    date: String,
) -> Result<Transaction, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    // Reverse old balance effect
    let (old_account_id, old_type, old_amount): (i64, String, f64) = conn
        .query_row(
            "SELECT account_id, transaction_type, amount FROM transactions WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let old_delta = match old_type.as_str() {
        "income" => -old_amount,
        "expense" => old_amount,
        _ => 0.0,
    };
    if old_delta != 0.0 {
        conn.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![old_delta, old_account_id],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE transactions SET account_id=?1, category_id=?2, transaction_type=?3,
         amount=?4, description=?5, payee=?6, date=?7 WHERE id=?8",
        params![account_id, category_id, transaction_type, amount, description, payee, date, id],
    )
    .map_err(|e| e.to_string())?;

    // Apply new balance effect
    let new_delta = match transaction_type.as_str() {
        "income" => amount,
        "expense" => -amount,
        _ => 0.0,
    };
    if new_delta != 0.0 {
        conn.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![new_delta, account_id],
        )
        .map_err(|e| e.to_string())?;
    }

    fetch_transaction(conn, id)
}

#[tauri::command]
pub fn delete_transaction(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let (account_id, transaction_type, amount): (i64, String, f64) = conn
        .query_row(
            "SELECT account_id, transaction_type, amount FROM transactions WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM transactions WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;

    let delta = match transaction_type.as_str() {
        "income" => -amount,
        "expense" => amount,
        _ => 0.0,
    };
    if delta != 0.0 {
        conn.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![delta, account_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn import_csv(
    state: tauri::State<AppState>,
    csv_content: String,
    account_id: i64,
    column_map: HashMap<String, usize>,
    transaction_type: String,
    date_format: String,
    has_header: bool,
) -> Result<ImportResult, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(has_header)
        .flexible(true)
        .from_reader(csv_content.as_bytes());

    let mut imported = 0;
    let mut skipped = 0;
    let mut errors: Vec<String> = Vec::new();

    for (i, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                errors.push(format!("Row {}: parse error: {}", i + 1, e));
                skipped += 1;
                continue;
            }
        };

        let get_col = |key: &str| -> Option<String> {
            column_map
                .get(key)
                .and_then(|&idx| record.get(idx))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        };

        let date_raw = match get_col("date") {
            Some(d) => d,
            None => {
                skipped += 1;
                continue;
            }
        };

        // Normalize date to YYYY-MM-DD
        let date = normalize_date(&date_raw, &date_format).unwrap_or(date_raw);

        let amount_raw = match get_col("amount") {
            Some(a) => a,
            None => {
                skipped += 1;
                continue;
            }
        };

        let amount: f64 = match amount_raw
            .replace(',', ".")
            .replace([' ', '\u{a0}'], "")
            .trim_start_matches('+')
            .parse()
        {
            Ok(v) => v,
            Err(_) => {
                errors.push(format!("Row {}: invalid amount '{}'", i + 1, amount_raw));
                skipped += 1;
                continue;
            }
        };

        let (actual_amount, actual_type) = if amount < 0.0 {
            (-amount, "expense")
        } else {
            (amount, "income")
        };

        let final_type = if transaction_type != "auto" {
            transaction_type.as_str()
        } else {
            actual_type
        };

        let description = get_col("description");
        let payee = get_col("payee");

        conn.execute(
            "INSERT INTO transactions (account_id, transaction_type, amount, description, payee, date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![account_id, final_type, actual_amount, description, payee, date],
        )
        .map_err(|e| {
            errors.push(format!("Row {}: insert failed: {}", i + 1, e));
        })
        .ok();

        let balance_delta = if final_type == "income" {
            actual_amount
        } else {
            -actual_amount
        };
        conn.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![balance_delta, account_id],
        )
        .ok();

        imported += 1;
    }

    Ok(ImportResult { imported, skipped, errors })
}

fn normalize_date(raw: &str, format: &str) -> Option<String> {
    let parts: Vec<&str> = raw.split(['-', '/', '.']).collect();
    if parts.len() != 3 {
        return None;
    }
    match format {
        "YYYY-MM-DD" => Some(raw.replace(['/', '.'], "-")),
        "DD/MM/YYYY" => Some(format!("{}-{}-{}", parts[2], parts[1], parts[0])),
        "MM/DD/YYYY" => Some(format!("{}-{}-{}", parts[2], parts[0], parts[1])),
        _ => Some(raw.to_string()),
    }
}

fn fetch_transaction(conn: &rusqlite::Connection, id: i64) -> Result<Transaction, String> {
    conn.query_row(
        "SELECT t.id, t.account_id, a.name, t.category_id, c.name, c.color, c.icon,
                t.transaction_type, t.amount, t.description, t.payee, t.date, t.created_at
         FROM transactions t
         LEFT JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.id = ?1",
        params![id],
        |row| {
            Ok(Transaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                account_name: row.get(2)?,
                category_id: row.get(3)?,
                category_name: row.get(4)?,
                category_color: row.get(5)?,
                category_icon: row.get(6)?,
                transaction_type: row.get(7)?,
                amount: row.get(8)?,
                description: row.get(9)?,
                payee: row.get(10)?,
                date: row.get(11)?,
                created_at: row.get(12)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}
