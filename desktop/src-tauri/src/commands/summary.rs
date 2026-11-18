use crate::AppState;
use chrono::{Months, NaiveDate};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Period summary: per-account, personal by month, personal/company by quarter
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct AccountSummary {
    pub id: i64,
    pub name: String,
    pub owner: String,
    pub currency: String,
    pub opening_balance: f64,
    pub money_in: f64,
    pub money_out: f64,
    pub net_change: f64,
    pub closing_balance: f64,
    pub transactions: i64,
}

#[derive(Debug, Serialize)]
pub struct MonthSummary {
    pub month: String,
    pub covers_from: String,
    pub covers_to: String,
    pub money_in: f64,
    pub money_out: f64,
    pub net: f64,
}

#[derive(Debug, Serialize)]
pub struct QuarterSummary {
    pub quarter: String,
    pub covers_from: String,
    pub covers_to: String,
    pub personal_in: f64,
    pub personal_out: f64,
    pub company_in: f64,
    pub company_out: f64,
}

#[derive(Debug, Serialize)]
pub struct Summary {
    pub accounts: Vec<AccountSummary>,
    pub months: Vec<MonthSummary>,
    pub quarters: Vec<QuarterSummary>,
}

/// Summarise the period `start_date..=end_date` (both `YYYY-MM-DD`).
///
/// Money in/out count income/expense transactions; transfers don't change
/// balances in this app, so they're excluded. Account balances are stored as
/// the current balance, so the closing balance is derived by undoing every
/// transaction dated after the period, and the opening balance by undoing the
/// period's own net change. "Covers" is the first and last transaction date
/// actually present in each month/quarter.
#[tauri::command]
pub fn get_summary(
    state: tauri::State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Summary, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;
    build_summary(conn, &start_date, &end_date).map_err(|e| e.to_string())
}

fn build_summary(conn: &Connection, start: &str, end: &str) -> rusqlite::Result<Summary> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.name, a.owner, a.currency, a.balance,
                COALESCE(SUM(CASE WHEN t.date > ?2 THEN
                    CASE t.transaction_type WHEN 'income' THEN t.amount
                                            WHEN 'expense' THEN -t.amount ELSE 0 END
                    ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN t.date BETWEEN ?1 AND ?2 AND t.transaction_type = 'income'
                    THEN t.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN t.date BETWEEN ?1 AND ?2 AND t.transaction_type = 'expense'
                    THEN t.amount ELSE 0 END), 0),
                COUNT(CASE WHEN t.date BETWEEN ?1 AND ?2 THEN 1 END)
         FROM accounts a
         LEFT JOIN transactions t ON t.account_id = a.id
         GROUP BY a.id
         ORDER BY a.owner DESC, a.name",
    )?;
    let accounts = stmt
        .query_map(params![start, end], |r| {
            let balance: f64 = r.get(4)?;
            let after: f64 = r.get(5)?;
            let money_in: f64 = r.get(6)?;
            let money_out: f64 = r.get(7)?;
            let closing = balance - after;
            let net = money_in - money_out;
            Ok(AccountSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                owner: r.get(2)?,
                currency: r.get(3)?,
                opening_balance: closing - net,
                money_in,
                money_out,
                net_change: net,
                closing_balance: closing,
                transactions: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut stmt = conn.prepare(
        "SELECT strftime('%Y-%m', t.date) AS m, MIN(t.date), MAX(t.date),
                COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0)
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         WHERE a.owner = 'personal'
           AND t.transaction_type IN ('income', 'expense')
           AND t.date BETWEEN ?1 AND ?2
         GROUP BY m
         HAVING m IS NOT NULL
         ORDER BY m",
    )?;
    let months = stmt
        .query_map(params![start, end], |r| {
            let money_in: f64 = r.get(3)?;
            let money_out: f64 = r.get(4)?;
            Ok(MonthSummary {
                month: r.get(0)?,
                covers_from: r.get(1)?,
                covers_to: r.get(2)?,
                money_in,
                money_out,
                net: money_in - money_out,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut stmt = conn.prepare(
        "SELECT strftime('%Y', t.date) || '-Q' ||
                    ((CAST(strftime('%m', t.date) AS INTEGER) + 2) / 3) AS q,
                MIN(t.date), MAX(t.date),
                COALESCE(SUM(CASE WHEN a.owner = 'personal' AND t.transaction_type = 'income'  THEN t.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN a.owner = 'personal' AND t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN a.owner = 'company'  AND t.transaction_type = 'income'  THEN t.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN a.owner = 'company'  AND t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0)
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         WHERE t.transaction_type IN ('income', 'expense')
           AND t.date BETWEEN ?1 AND ?2
         GROUP BY q
         HAVING q IS NOT NULL
         ORDER BY q",
    )?;
    let quarters = stmt
        .query_map(params![start, end], |r| {
            Ok(QuarterSummary {
                quarter: r.get(0)?,
                covers_from: r.get(1)?,
                covers_to: r.get(2)?,
                personal_in: r.get(3)?,
                personal_out: r.get(4)?,
                company_in: r.get(5)?,
                company_out: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Summary {
        accounts,
        months,
        quarters,
    })
}

// ---------------------------------------------------------------------------
// Recurring payments: detected from history, confirmed/dismissed by the user
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct RecurringItem {
    /// Stable identity: "<type>:<normalized payee>".
    pub key: String,
    pub name: String,
    /// "monthly" | "quarterly" | "annual"
    pub frequency: String,
    pub transaction_type: String,
    /// Typical (median) amount.
    pub amount: f64,
    pub occurrences: usize,
    pub first_date: Option<String>,
    pub last_date: Option<String>,
    pub next_date: Option<String>,
    pub account: Option<String>,
    /// "detected" | "confirmed" | "dismissed"
    pub status: String,
    /// No payment seen for well over one period.
    pub possibly_ended: bool,
}

struct Tx {
    date: NaiveDate,
    amount: f64,
    name: String,
    account: String,
}

struct Frequency {
    name: &'static str,
    /// Accepted gap between consecutive payments, in days.
    gap: (i64, i64),
    months: u32,
    min_occurrences: usize,
}

const FREQUENCIES: [Frequency; 3] = [
    Frequency {
        name: "monthly",
        gap: (24, 38),
        months: 1,
        min_occurrences: 3,
    },
    Frequency {
        name: "quarterly",
        gap: (80, 100),
        months: 3,
        min_occurrences: 2,
    },
    Frequency {
        name: "annual",
        gap: (350, 380),
        months: 12,
        min_occurrences: 2,
    },
];

/// Reduce a payee/description to a grouping key: lowercase letters only, so
/// "NETFLIX.COM 12/03 #4411" and "Netflix.com 12/04 #9921" group together.
fn normalize_payee(s: &str) -> String {
    let cleaned: String = s
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphabetic() { c } else { ' ' })
        .collect();
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn median(values: &mut [f64]) -> f64 {
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = values.len();
    if n == 0 {
        0.0
    } else if n % 2 == 1 {
        values[n / 2]
    } else {
        (values[n / 2 - 1] + values[n / 2]) / 2.0
    }
}

/// Decide whether a payee's (date-sorted) transactions form a recurring series.
fn classify(txs: &[Tx]) -> Option<&'static Frequency> {
    // Several charges on the same day (e.g. split payments) count once.
    let mut dates: Vec<NaiveDate> = txs.iter().map(|t| t.date).collect();
    dates.dedup();
    if dates.len() < 2 {
        return None;
    }
    let gaps: Vec<i64> = dates.windows(2).map(|w| (w[1] - w[0]).num_days()).collect();
    let mut gap_values: Vec<f64> = gaps.iter().map(|&g| g as f64).collect();
    let median_gap = median(&mut gap_values) as i64;

    let freq = FREQUENCIES
        .iter()
        .find(|f| median_gap >= f.gap.0 && median_gap <= f.gap.1)?;
    if dates.len() < freq.min_occurrences {
        return None;
    }
    // Most gaps must fit the period (tolerates one missed or late payment).
    let fitting = gaps
        .iter()
        .filter(|&&g| g >= freq.gap.0 && g <= freq.gap.1)
        .count();
    if (fitting as f64) < (gaps.len() as f64) * 0.75 {
        return None;
    }
    // Amounts must be roughly stable (±25% of the median).
    let mut amounts: Vec<f64> = txs.iter().map(|t| t.amount).collect();
    let typical = median(&mut amounts);
    let stable = txs
        .iter()
        .filter(|t| (t.amount - typical).abs() <= typical.abs() * 0.25)
        .count();
    if (stable as f64) < (txs.len() as f64) * 0.75 {
        return None;
    }
    Some(freq)
}

fn detect_recurring(conn: &Connection, today: NaiveDate) -> rusqlite::Result<Vec<RecurringItem>> {
    let mut stmt = conn.prepare(
        "SELECT t.transaction_type, t.date, t.amount,
                COALESCE(NULLIF(TRIM(t.payee), ''), t.description, ''), a.name
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         WHERE t.transaction_type IN ('income', 'expense')",
    )?;
    let mut groups: HashMap<String, (String, Vec<Tx>)> = HashMap::new();
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, f64>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
        ))
    })?;
    for row in rows {
        let (ttype, date, amount, name, account) = row?;
        let Ok(date) = NaiveDate::parse_from_str(date.trim(), "%Y-%m-%d") else {
            continue;
        };
        let norm = normalize_payee(&name);
        if norm.is_empty() {
            continue;
        }
        let key = format!("{}:{}", ttype, norm);
        groups
            .entry(key)
            .or_insert_with(|| (ttype.clone(), Vec::new()))
            .1
            .push(Tx {
                date,
                amount: amount.abs(),
                name: name.trim().to_string(),
                account,
            });
    }

    let mut items = Vec::new();
    for (key, (ttype, mut txs)) in groups {
        txs.sort_by_key(|t| t.date);
        let Some(freq) = classify(&txs) else { continue };
        let mut amounts: Vec<f64> = txs.iter().map(|t| t.amount).collect();
        let last = txs.last().unwrap();
        let next = last.date.checked_add_months(Months::new(freq.months));
        let overdue_days = (today - last.date).num_days();
        items.push(RecurringItem {
            key,
            name: last.name.clone(),
            frequency: freq.name.to_string(),
            transaction_type: ttype,
            amount: (median(&mut amounts) * 100.0).round() / 100.0,
            occurrences: txs.len(),
            first_date: Some(txs[0].date.to_string()),
            last_date: Some(last.date.to_string()),
            next_date: next.map(|d| d.to_string()),
            account: Some(last.account.clone()),
            status: "detected".into(),
            possibly_ended: overdue_days as f64 > freq.gap.1 as f64 * 1.5,
        });
    }
    Ok(items)
}

#[tauri::command]
pub fn get_recurring(state: tauri::State<AppState>) -> Result<Vec<RecurringItem>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;
    let today = chrono::Local::now().date_naive();

    let mut items = detect_recurring(conn, today).map_err(|e| e.to_string())?;

    // Overlay saved decisions; keep confirmed items even if no longer detected.
    let mut stmt = conn
        .prepare(
            "SELECT key, name, frequency, transaction_type, amount, status FROM recurring_items",
        )
        .map_err(|e| e.to_string())?;
    let saved = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, f64>(4)?,
                r.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (key, name, frequency, ttype, amount, status) in saved {
        if let Some(item) = items.iter_mut().find(|i| i.key == key) {
            item.status = status;
            item.frequency = frequency;
            item.name = name;
        } else if status == "confirmed" {
            items.push(RecurringItem {
                key,
                name,
                frequency,
                transaction_type: ttype,
                amount,
                occurrences: 0,
                first_date: None,
                last_date: None,
                next_date: None,
                account: None,
                status,
                possibly_ended: false,
            });
        }
    }

    items.sort_by(|a, b| {
        b.amount
            .partial_cmp(&a.amount)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    Ok(items)
}

/// Record the user's decision on a recurring item. `status` "detected"
/// clears any saved decision.
#[tauri::command]
pub fn set_recurring_status(
    state: tauri::State<AppState>,
    key: String,
    name: String,
    frequency: String,
    transaction_type: String,
    amount: f64,
    status: String,
) -> Result<(), String> {
    if !["monthly", "quarterly", "annual"].contains(&frequency.as_str()) {
        return Err(format!("Invalid frequency '{}'", frequency));
    }
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;
    match status.as_str() {
        "detected" => conn.execute("DELETE FROM recurring_items WHERE key = ?1", params![key]),
        "confirmed" | "dismissed" => conn.execute(
            "INSERT OR REPLACE INTO recurring_items (key, name, frequency, transaction_type, amount, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![key, name, frequency, transaction_type, amount, status],
        ),
        _ => return Err(format!("Invalid status '{}'", status)),
    }
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Owed & debts ledger
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct Debt {
    pub id: i64,
    /// "owed_to_me" | "i_owe"
    pub direction: String,
    pub counterparty: String,
    pub amount: f64,
    pub currency: String,
    pub due_date: Option<String>,
    pub note: Option<String>,
    pub settled: bool,
    pub created_at: String,
}

fn check_direction(direction: &str) -> Result<(), String> {
    if direction == "owed_to_me" || direction == "i_owe" {
        Ok(())
    } else {
        Err(format!("Invalid direction '{}'", direction))
    }
}

fn empty_to_none(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

#[tauri::command]
pub fn get_debts(state: tauri::State<AppState>) -> Result<Vec<Debt>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;
    let mut stmt = conn
        .prepare(
            "SELECT id, direction, counterparty, amount, currency, due_date, note, settled, created_at
             FROM debts
             ORDER BY settled, due_date IS NULL, due_date, counterparty",
        )
        .map_err(|e| e.to_string())?;
    let debts = stmt
        .query_map([], |r| {
            Ok(Debt {
                id: r.get(0)?,
                direction: r.get(1)?,
                counterparty: r.get(2)?,
                amount: r.get(3)?,
                currency: r.get(4)?,
                due_date: r.get(5)?,
                note: r.get(6)?,
                settled: r.get::<_, i64>(7)? != 0,
                created_at: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(debts)
}

#[tauri::command]
pub fn add_debt(
    state: tauri::State<AppState>,
    direction: String,
    counterparty: String,
    amount: f64,
    currency: String,
    due_date: Option<String>,
    note: Option<String>,
) -> Result<(), String> {
    check_direction(&direction)?;
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;
    conn.execute(
        "INSERT INTO debts (direction, counterparty, amount, currency, due_date, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            direction,
            counterparty.trim(),
            amount.abs(),
            currency,
            empty_to_none(due_date),
            empty_to_none(note)
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_debt(
    state: tauri::State<AppState>,
    id: i64,
    direction: String,
    counterparty: String,
    amount: f64,
    currency: String,
    due_date: Option<String>,
    note: Option<String>,
    settled: bool,
) -> Result<(), String> {
    check_direction(&direction)?;
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;
    conn.execute(
        "UPDATE debts SET direction=?1, counterparty=?2, amount=?3, currency=?4, due_date=?5, note=?6, settled=?7
         WHERE id=?8",
        params![
            direction,
            counterparty.trim(),
            amount.abs(),
            currency,
            empty_to_none(due_date),
            empty_to_none(note),
            settled as i64,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_debt(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("No database open")?;
    conn.execute("DELETE FROM debts WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::initialize_schema(&conn).unwrap();
        conn
    }

    fn add_tx(conn: &Connection, account: i64, ttype: &str, amount: f64, payee: &str, date: &str) {
        conn.execute(
            "INSERT INTO transactions (account_id, transaction_type, amount, payee, date) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![account, ttype, amount, payee, date],
        )
        .unwrap();
        let delta = if ttype == "income" { amount } else { -amount };
        conn.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![delta, account],
        )
        .unwrap();
    }

    #[test]
    fn summary_balances_months_and_quarters() {
        let conn = setup();
        conn.execute(
            "INSERT INTO accounts (name, balance, owner) VALUES ('Personal', 1000, 'personal'), ('Company', 0, 'company')",
            [],
        )
        .unwrap();
        add_tx(&conn, 1, "income", 2000.0, "Salary", "2026-01-31");
        add_tx(&conn, 1, "expense", 500.0, "Rent", "2026-02-01");
        add_tx(&conn, 1, "expense", 100.0, "Shop", "2026-04-10");
        add_tx(&conn, 2, "income", 300.0, "Client", "2026-03-15");
        // After the period: must be excluded from the period and the closing balance.
        add_tx(&conn, 1, "expense", 50.0, "Later", "2027-01-05");

        let s = build_summary(&conn, "2026-01-01", "2026-12-31").unwrap();

        let p = s.accounts.iter().find(|a| a.name == "Personal").unwrap();
        assert_eq!(p.opening_balance, 1000.0);
        assert_eq!(p.money_in, 2000.0);
        assert_eq!(p.money_out, 600.0);
        assert_eq!(p.net_change, 1400.0);
        assert_eq!(p.closing_balance, 2400.0);
        assert_eq!(p.transactions, 3);

        // Personal by month excludes the company account.
        let months: Vec<_> = s.months.iter().map(|m| (m.month.as_str(), m.net)).collect();
        assert_eq!(
            months,
            vec![
                ("2026-01", 2000.0),
                ("2026-02", -500.0),
                ("2026-04", -100.0)
            ]
        );

        assert_eq!(s.quarters.len(), 2);
        let q1 = &s.quarters[0];
        assert_eq!(q1.quarter, "2026-Q1");
        assert_eq!((q1.personal_in, q1.personal_out), (2000.0, 500.0));
        assert_eq!((q1.company_in, q1.company_out), (300.0, 0.0));
        assert_eq!(
            (q1.covers_from.as_str(), q1.covers_to.as_str()),
            ("2026-01-31", "2026-03-15")
        );
        assert_eq!(s.quarters[1].quarter, "2026-Q2");
    }

    #[test]
    fn detects_monthly_quarterly_and_annual() {
        let conn = setup();
        conn.execute("INSERT INTO accounts (name) VALUES ('Main')", [])
            .unwrap();
        for (i, d) in ["2026-01-03", "2026-02-03", "2026-03-04", "2026-04-03"]
            .iter()
            .enumerate()
        {
            add_tx(
                &conn,
                1,
                "expense",
                15.99,
                &format!("NETFLIX.COM #{}", 100 + i),
                d,
            );
        }
        for d in ["2025-11-20", "2026-02-20", "2026-05-21"] {
            add_tx(&conn, 1, "expense", 120.0, "Water utility", d);
        }
        for d in ["2024-06-01", "2025-06-01"] {
            add_tx(&conn, 1, "expense", 89.0, "Domain renewal", d);
        }
        // Irregular: should not be detected.
        for d in ["2026-01-01", "2026-01-09", "2026-03-30"] {
            add_tx(&conn, 1, "expense", 40.0, "Supermarket", d);
        }

        let today = NaiveDate::from_ymd_opt(2026, 4, 20).unwrap();
        let mut found: Vec<(String, String)> = detect_recurring(&conn, today)
            .unwrap()
            .into_iter()
            .map(|i| (i.key, i.frequency))
            .collect();
        found.sort();
        assert_eq!(
            found,
            vec![
                ("expense:domain renewal".to_string(), "annual".to_string()),
                ("expense:netflix com".to_string(), "monthly".to_string()),
                ("expense:water utility".to_string(), "quarterly".to_string()),
            ]
        );
    }

    #[test]
    fn rejects_unstable_amounts() {
        let conn = setup();
        conn.execute("INSERT INTO accounts (name) VALUES ('Main')", [])
            .unwrap();
        for (d, amt) in [
            ("2026-01-05", 10.0),
            ("2026-02-05", 200.0),
            ("2026-03-05", 35.0),
            ("2026-04-05", 500.0),
        ] {
            add_tx(&conn, 1, "expense", amt, "Restaurant", d);
        }
        let today = NaiveDate::from_ymd_opt(2026, 4, 20).unwrap();
        assert!(detect_recurring(&conn, today).unwrap().is_empty());
    }
}
