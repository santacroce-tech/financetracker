use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub category_type: String,
    pub icon: String,
    pub color: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_categories(state: tauri::State<AppState>) -> Result<Vec<Category>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare("SELECT id, name, category_type, icon, color, created_at FROM categories ORDER BY category_type, name")
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                category_type: row.get(2)?,
                icon: row.get(3)?,
                color: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
}

#[tauri::command]
pub fn add_category(
    state: tauri::State<AppState>,
    name: String,
    category_type: String,
    icon: String,
    color: String,
) -> Result<Category, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO categories (name, category_type, icon, color) VALUES (?1, ?2, ?3, ?4)",
        params![name, category_type, icon, color],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let category = conn
        .query_row(
            "SELECT id, name, category_type, icon, color, created_at FROM categories WHERE id = ?1",
            params![id],
            |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    category_type: row.get(2)?,
                    icon: row.get(3)?,
                    color: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(category)
}

#[tauri::command]
pub fn update_category(
    state: tauri::State<AppState>,
    id: i64,
    name: String,
    category_type: String,
    icon: String,
    color: String,
) -> Result<Category, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE categories SET name=?1, category_type=?2, icon=?3, color=?4 WHERE id=?5",
        params![name, category_type, icon, color, id],
    )
    .map_err(|e| e.to_string())?;

    let category = conn
        .query_row(
            "SELECT id, name, category_type, icon, color, created_at FROM categories WHERE id = ?1",
            params![id],
            |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    category_type: row.get(2)?,
                    icon: row.get(3)?,
                    color: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(category)
}

#[tauri::command]
pub fn delete_category(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;

    conn.execute("DELETE FROM categories WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}
