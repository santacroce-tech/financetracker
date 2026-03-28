use crate::AppState;
use regex::Regex;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rule {
    pub id: i64,
    pub category_id: i64,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub pattern: String,
    pub match_field: String,
    pub is_regex: bool,
    pub priority: i64,
    pub created_at: String,
}

#[tauri::command]
pub fn get_rules(state: tauri::State<AppState>) -> Result<Vec<Rule>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare(
            "SELECT r.id, r.category_id, c.name, c.color, r.pattern, r.match_field,
                    r.is_regex, r.priority, r.created_at
             FROM category_rules r
             LEFT JOIN categories c ON r.category_id = c.id
             ORDER BY r.priority DESC, r.id",
        )
        .map_err(|e| e.to_string())?;

    let rules = stmt
        .query_map([], |row| {
            Ok(Rule {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                category_color: row.get(3)?,
                pattern: row.get(4)?,
                match_field: row.get(5)?,
                is_regex: row.get::<_, i64>(6)? != 0,
                priority: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rules)
}

#[tauri::command]
pub fn add_rule(
    state: tauri::State<AppState>,
    category_id: i64,
    pattern: String,
    match_field: String,
    is_regex: bool,
    priority: i64,
) -> Result<Rule, String> {
    if is_regex {
        Regex::new(&pattern).map_err(|e| format!("Invalid regex: {}", e))?;
    }

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO category_rules (category_id, pattern, match_field, is_regex, priority)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![category_id, pattern, match_field, is_regex as i64, priority],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    fetch_rule(conn, id)
}

#[tauri::command]
pub fn update_rule(
    state: tauri::State<AppState>,
    id: i64,
    category_id: i64,
    pattern: String,
    match_field: String,
    is_regex: bool,
    priority: i64,
) -> Result<Rule, String> {
    if is_regex {
        Regex::new(&pattern).map_err(|e| format!("Invalid regex: {}", e))?;
    }

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE category_rules SET category_id=?1, pattern=?2, match_field=?3, is_regex=?4, priority=?5 WHERE id=?6",
        params![category_id, pattern, match_field, is_regex as i64, priority, id],
    )
    .map_err(|e| e.to_string())?;

    fetch_rule(conn, id)
}

#[tauri::command]
pub fn delete_rule(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute("DELETE FROM category_rules WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn auto_categorize(state: tauri::State<AppState>) -> Result<usize, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    // Load all rules ordered by priority desc
    let mut rule_stmt = conn
        .prepare(
            "SELECT id, category_id, pattern, match_field, is_regex FROM category_rules ORDER BY priority DESC",
        )
        .map_err(|e| e.to_string())?;

    struct RuleRow {
        category_id: i64,
        pattern: String,
        match_field: String,
        is_regex: bool,
    }

    let rules: Vec<RuleRow> = rule_stmt
        .query_map([], |row| {
            Ok(RuleRow {
                category_id: row.get(1)?,
                pattern: row.get(2)?,
                match_field: row.get(3)?,
                is_regex: row.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Load uncategorized transactions
    let mut tx_stmt = conn
        .prepare("SELECT id, description, payee FROM transactions WHERE category_id IS NULL")
        .map_err(|e| e.to_string())?;

    struct TxRow {
        id: i64,
        description: Option<String>,
        payee: Option<String>,
    }

    let txs: Vec<TxRow> = tx_stmt
        .query_map([], |row| {
            Ok(TxRow {
                id: row.get(0)?,
                description: row.get(1)?,
                payee: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut count = 0;

    for tx in &txs {
        for rule in &rules {
            let target = match rule.match_field.as_str() {
                "payee" => tx.payee.as_deref().unwrap_or(""),
                _ => tx.description.as_deref().unwrap_or(""),
            };

            let matches = if rule.is_regex {
                Regex::new(&rule.pattern)
                    .map(|re| re.is_match(target))
                    .unwrap_or(false)
            } else {
                target
                    .to_lowercase()
                    .contains(&rule.pattern.to_lowercase())
            };

            if matches {
                conn.execute(
                    "UPDATE transactions SET category_id = ?1 WHERE id = ?2",
                    params![rule.category_id, tx.id],
                )
                .ok();
                count += 1;
                break;
            }
        }
    }

    Ok(count)
}

fn fetch_rule(conn: &rusqlite::Connection, id: i64) -> Result<Rule, String> {
    conn.query_row(
        "SELECT r.id, r.category_id, c.name, c.color, r.pattern, r.match_field,
                r.is_regex, r.priority, r.created_at
         FROM category_rules r LEFT JOIN categories c ON r.category_id = c.id WHERE r.id = ?1",
        params![id],
        |row| {
            Ok(Rule {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                category_color: row.get(3)?,
                pattern: row.get(4)?,
                match_field: row.get(5)?,
                is_regex: row.get::<_, i64>(6)? != 0,
                priority: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}
