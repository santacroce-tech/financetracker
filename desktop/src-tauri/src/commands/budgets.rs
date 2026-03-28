use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Budget {
    pub id: i64,
    pub category_id: i64,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub category_icon: Option<String>,
    pub amount: f64,
    pub period: String,
    pub start_date: String,
    pub spent: f64,
    pub created_at: String,
}

#[tauri::command]
pub fn get_budgets(state: tauri::State<AppState>) -> Result<Vec<Budget>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    // Get current month range for spending calculation
    let now = chrono::Local::now();
    let month_start = format!("{}-{:02}-01", now.format("%Y"), now.format("%m"));
    let month_end = format!("{}-{:02}-31", now.format("%Y"), now.format("%m"));

    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.category_id, c.name, c.color, c.icon, b.amount, b.period, b.start_date, b.created_at,
                    COALESCE((
                        SELECT SUM(t.amount) FROM transactions t
                        WHERE t.category_id = b.category_id
                          AND t.transaction_type = 'expense'
                          AND t.date BETWEEN ?1 AND ?2
                    ), 0) as spent
             FROM budgets b
             LEFT JOIN categories c ON b.category_id = c.id
             ORDER BY c.name",
        )
        .map_err(|e| e.to_string())?;

    let budgets = stmt
        .query_map(params![month_start, month_end], |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                category_color: row.get(3)?,
                category_icon: row.get(4)?,
                amount: row.get(5)?,
                period: row.get(6)?,
                start_date: row.get(7)?,
                created_at: row.get(8)?,
                spent: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(budgets)
}

#[tauri::command]
pub fn add_budget(
    state: tauri::State<AppState>,
    category_id: i64,
    amount: f64,
    period: String,
    start_date: String,
) -> Result<Budget, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO budgets (category_id, amount, period, start_date) VALUES (?1, ?2, ?3, ?4)",
        params![category_id, amount, period, start_date],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    fetch_budget(conn, id)
}

#[tauri::command]
pub fn update_budget(
    state: tauri::State<AppState>,
    id: i64,
    category_id: i64,
    amount: f64,
    period: String,
    start_date: String,
) -> Result<Budget, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE budgets SET category_id=?1, amount=?2, period=?3, start_date=?4 WHERE id=?5",
        params![category_id, amount, period, start_date, id],
    )
    .map_err(|e| e.to_string())?;

    fetch_budget(conn, id)
}

#[tauri::command]
pub fn delete_budget(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute("DELETE FROM budgets WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn fetch_budget(conn: &rusqlite::Connection, id: i64) -> Result<Budget, String> {
    conn.query_row(
        "SELECT b.id, b.category_id, c.name, c.color, c.icon, b.amount, b.period, b.start_date, b.created_at, 0.0
         FROM budgets b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?1",
        params![id],
        |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                category_color: row.get(3)?,
                category_icon: row.get(4)?,
                amount: row.get(5)?,
                period: row.get(6)?,
                start_date: row.get(7)?,
                created_at: row.get(8)?,
                spent: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}
