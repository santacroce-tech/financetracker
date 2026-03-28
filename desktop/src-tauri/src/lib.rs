mod commands;
mod db;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Option<Connection>>,
    pub db_path: Mutex<Option<String>>,
}

#[tauri::command]
fn open_db(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let conn = db::open_database(&path).map_err(|e| e.to_string())?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let mut path_guard = state.db_path.lock().map_err(|e| e.to_string())?;
    *db_guard = Some(conn);
    *path_guard = Some(path);
    Ok(())
}

#[tauri::command]
fn create_db(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let conn = db::open_database(&path).map_err(|e| e.to_string())?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let mut path_guard = state.db_path.lock().map_err(|e| e.to_string())?;
    *db_guard = Some(conn);
    *path_guard = Some(path);
    Ok(())
}

#[tauri::command]
fn get_db_path(state: tauri::State<AppState>) -> Option<String> {
    state.db_path.lock().ok()?.clone()
}

#[tauri::command]
fn close_db(state: tauri::State<AppState>) -> Result<(), String> {
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let mut path_guard = state.db_path.lock().map_err(|e| e.to_string())?;
    *db_guard = None;
    *path_guard = None;
    Ok(())
}

#[tauri::command]
fn open_demo_db(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<String, String> {
    // Resolve the bundled demo.db from app resources
    let resource_path = app
        .path()
        .resolve("resources/demo.db", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Could not find demo database: {}", e))?;

    // Copy to a temp directory so the user gets a writable copy
    let temp_dir = std::env::temp_dir().join("financetracker-demo");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let dest = temp_dir.join("demo.db");
    std::fs::copy(&resource_path, &dest).map_err(|e| format!("Could not copy demo database: {}", e))?;

    let path_str = dest.to_string_lossy().to_string();

    // Open the copied demo database
    let conn = db::open_database(&path_str).map_err(|e| e.to_string())?;
    let mut db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let mut path_guard = state.db_path.lock().map_err(|e| e.to_string())?;
    *db_guard = Some(conn);
    *path_guard = Some(path_str.clone());

    Ok(path_str)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState {
            db: Mutex::new(None),
            db_path: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // DB lifecycle
            open_db,
            create_db,
            get_db_path,
            close_db,
            open_demo_db,
            // Accounts
            commands::accounts::get_accounts,
            commands::accounts::add_account,
            commands::accounts::update_account,
            commands::accounts::delete_account,
            // Transactions
            commands::transactions::get_transactions,
            commands::transactions::add_transaction,
            commands::transactions::update_transaction,
            commands::transactions::delete_transaction,
            commands::transactions::import_csv,
            // Categories
            commands::categories::get_categories,
            commands::categories::add_category,
            commands::categories::update_category,
            commands::categories::delete_category,
            // Budgets
            commands::budgets::get_budgets,
            commands::budgets::add_budget,
            commands::budgets::update_budget,
            commands::budgets::delete_budget,
            // Rules
            commands::rules::get_rules,
            commands::rules::add_rule,
            commands::rules::update_rule,
            commands::rules::delete_rule,
            commands::rules::auto_categorize,
            // Reports
            commands::reports::get_dashboard_stats,
            commands::reports::get_monthly_data,
            commands::reports::get_category_spending,
            commands::reports::get_top_payees,
            commands::reports::get_recent_transactions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
