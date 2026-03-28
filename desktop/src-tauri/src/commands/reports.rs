use crate::AppState;
use rusqlite::params;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_balance: f64,
    pub monthly_income: f64,
    pub monthly_expenses: f64,
    pub account_count: i64,
    pub transaction_count: i64,
    pub uncategorized_count: i64,
}

#[derive(Debug, Serialize)]
pub struct MonthlyData {
    pub month: String,
    pub income: f64,
    pub expenses: f64,
}

#[derive(Debug, Serialize)]
pub struct CategorySpending {
    pub category_name: String,
    pub category_color: String,
    pub category_icon: String,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct TopPayee {
    pub payee: String,
    pub total: f64,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct RecentTransaction {
    pub id: i64,
    pub description: Option<String>,
    pub payee: Option<String>,
    pub amount: f64,
    pub transaction_type: String,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub account_name: Option<String>,
    pub date: String,
}

#[tauri::command]
pub fn get_dashboard_stats(state: tauri::State<AppState>) -> Result<DashboardStats, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let now = chrono::Local::now();
    let month_start = format!("{}-{:02}-01", now.format("%Y"), now.format("%m"));
    let month_end = format!("{}-{:02}-31", now.format("%Y"), now.format("%m"));

    let total_balance: f64 = conn
        .query_row("SELECT COALESCE(SUM(balance), 0) FROM accounts", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let monthly_income: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type='income' AND date BETWEEN ?1 AND ?2",
            params![month_start, month_end],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let monthly_expenses: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE transaction_type='expense' AND date BETWEEN ?1 AND ?2",
            params![month_start, month_end],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let account_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM accounts", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let transaction_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let uncategorized_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE category_id IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(DashboardStats {
        total_balance,
        monthly_income,
        monthly_expenses,
        account_count,
        transaction_count,
        uncategorized_count,
    })
}

#[tauri::command]
pub fn get_monthly_data(
    state: tauri::State<AppState>,
    months: u32,
) -> Result<Vec<MonthlyData>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m', date) as month,
                    COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END), 0) as expenses
             FROM transactions
             WHERE date >= date('now', ?1)
             GROUP BY month
             ORDER BY month ASC",
        )
        .map_err(|e| e.to_string())?;

    let offset = format!("-{} months", months);
    let data = stmt
        .query_map(params![offset], |row| {
            Ok(MonthlyData {
                month: row.get(0)?,
                income: row.get(1)?,
                expenses: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(data)
}

#[tauri::command]
pub fn get_category_spending(
    state: tauri::State<AppState>,
    period: String,
) -> Result<Vec<CategorySpending>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let date_filter = match period.as_str() {
        "this_month" => "date >= date('now', 'start of month')".to_string(),
        "last_month" => {
            "date >= date('now', 'start of month', '-1 month') AND date < date('now', 'start of month')".to_string()
        }
        "this_year" => "date >= date('now', 'start of year')".to_string(),
        _ => "1=1".to_string(),
    };

    let sql = format!(
        "SELECT c.name, COALESCE(c.color, '#6c757d'), COALESCE(c.icon, 'tag'),
                COALESCE(SUM(t.amount), 0) as total
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.transaction_type = 'expense' AND {}
         GROUP BY c.id
         ORDER BY total DESC
         LIMIT 10",
        date_filter
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let data = stmt
        .query_map([], |row| {
            Ok(CategorySpending {
                category_name: row.get(0)?,
                category_color: row.get(1)?,
                category_icon: row.get(2)?,
                total: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(data)
}

#[tauri::command]
pub fn get_top_payees(
    state: tauri::State<AppState>,
    limit: u32,
) -> Result<Vec<TopPayee>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(payee, description, 'Unknown') as payee,
                    SUM(amount) as total, COUNT(*) as cnt
             FROM transactions
             WHERE transaction_type = 'expense' AND (payee IS NOT NULL OR description IS NOT NULL)
             GROUP BY COALESCE(payee, description)
             ORDER BY total DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let data = stmt
        .query_map(params![limit], |row| {
            Ok(TopPayee {
                payee: row.get(0)?,
                total: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(data)
}

#[tauri::command]
pub fn get_recent_transactions(
    state: tauri::State<AppState>,
    limit: u32,
) -> Result<Vec<RecentTransaction>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.description, t.payee, t.amount, t.transaction_type,
                    c.name, c.color, a.name, t.date
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN accounts a ON t.account_id = a.id
             ORDER BY t.date DESC, t.id DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let data = stmt
        .query_map(params![limit], |row| {
            Ok(RecentTransaction {
                id: row.get(0)?,
                description: row.get(1)?,
                payee: row.get(2)?,
                amount: row.get(3)?,
                transaction_type: row.get(4)?,
                category_name: row.get(5)?,
                category_color: row.get(6)?,
                account_name: row.get(7)?,
                date: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(data)
}
