# How We Built FinanceTracker: From a Weekend Hack to an Open-Source Desktop App

*By Santacroce Tech*

---

## The Problem: We Just Wanted Quicken, But Open Source

It started with a simple frustration. We needed a personal finance tracker — something to import bank CSV exports, categorize transactions, and see where the money was going. We'd used Quicken years ago and loved how fast it was: keyboard shortcuts to fly through transactions, rules to auto-categorize recurring payments, and a clean interface that stayed out of the way.

But Quicken had become a subscription service tied to the cloud. Mint was gone. YNAB wanted $100/year. And all of them wanted our financial data on their servers. We wanted something simpler: an app that reads CSV files, lets us categorize with keyboard shortcuts, tracks budgets, and keeps everything in a local SQLite file we fully control.

Nothing fit. So we built it.

## Bootstrapping with Claude: Web Version in a Weekend

We started with what we knew: Python, Flask, SQLite. The goal was minimal — just solve the immediate pain. Import a CSV from the bank, map the columns, and get transactions into a database. Add some categories. Show a chart.

Using Claude Opus 4.5, we bootstrapped the entire web application in a weekend. Not a toy prototype — a fully working app with:

- **Multi-account support** — checking, savings, credit cards, cash, investments
- **CSV import** with automatic date and number format detection (US and European)
- **Auto-categorization rules** — regex or text patterns that fire on import
- **Keyboard-driven clearing** — the feature we missed most from Quicken. Press 1-9 to instantly assign a category, J/K to navigate, S to skip. You can blow through 50 uncategorized transactions in under a minute
- **Budget tracking** with progress bars and over-budget warnings
- **Reports** with Chart.js — monthly income vs. expenses, spending by category, top payees, savings rate
- **Email inbox** — forward receipts to a unique address and they get parsed automatically

The whole thing runs on a single SQLite file. No Postgres, no Redis, no external dependencies. `pip install`, `python app.py`, done.

## The "Can I Use It Too?" Problem

After a few months, friends saw it and wanted in. "Can you set me up an account?"

Here's the thing — we didn't want to be in charge of anyone's financial data. That's a responsibility we never signed up for. Hosting other people's bank transactions, even for friends, felt wrong.

So we made a decision: the web version at [app.financetracker.pro](https://app.financetracker.pro) is a **demo only**. There's a `demo/demo` account anyone can log into to explore the interface, but it's purely a showcase. We're not a SaaS company. We don't want your data.

The real solution was obvious: give people the app itself.

## Going Native with Tauri

We built a **native desktop app** using Tauri v2 — a framework that wraps a web frontend (React, in our case) with a Rust backend. It compiles to native binaries for macOS, Windows, and Linux.

The desktop version has one key difference from the web app: **there's no login**. Instead of usernames and passwords, you just pick a `.db` file from your computer. Want multiple budgets? Create multiple files. Want to share with your partner? Send them the file. Want to back up? Copy the file. It's that simple.

The Rust backend handles all the SQLite operations through `rusqlite` with the SQLite engine bundled directly into the binary. No installation, no configuration, no database server. Download, open, go.

We added three languages — **English**, **Portuguese (Brazil)**, and **Spanish** — because our team and friends span those communities. Switching is instant from the sidebar.

And because we know the first question is always "what does it look like?", the app ships with a **bundled demo database**: 4 accounts, 181 transactions across 6 months, budgets, categorization rules — everything pre-loaded so you can click "Try Demo" and explore immediately.

## The Stack

The desktop app is intentionally boring technology:

- **Tauri v2** — native shell, ~5MB binary, no Electron bloat
- **Rust + rusqlite** — backend commands, bundled SQLite, zero runtime dependencies
- **React 18 + Vite** — frontend, hot reload in dev
- **Bootstrap 5** — same CSS as the web version, looks identical
- **Chart.js** — reports and visualizations
- **react-i18next** — internationalization

The web version is even simpler:

- **Python + Flask** — backend
- **Jinja2 + Bootstrap** — server-rendered templates
- **SQLite** — everything in one file

Both versions share the same schema, the same UI patterns, and the same keyboard shortcuts. If you know one, you know the other.

## Your Data is Just SQLite

Here's what we think is the most underrated feature: your financial data lives in a **plain SQLite file**. Not a proprietary format. Not a cloud database. A `.db` file you can open with any SQLite tool.

This means you can explore your own financial data with tools you already have. `sqlite3` on the command line. DB Browser for SQLite. Or — and this is where it gets fun — [EEditor](https://eeditor.app).

### Exploring Your Finances with EEditor and EELisp

EEditor is a native markdown editor for Mac, iPhone, and iPad with a built-in Lisp interpreter ([EELisp](https://eelisp.app)) that speaks SQLite natively. You can open your FinanceTracker `.db` file and write live queries right inside a markdown document.

Here's a practical example. Create a new `.md` file in EEditor, then add an EELisp code block that connects to your finance database and runs a report:

#### Monthly Spending Summary

````markdown
```eelisp
;; Open the FinanceTracker database
(open-db "/path/to/your/finance.db")

;; Query monthly expenses grouped by category
(query "SELECT c.name AS category,
               c.icon,
               ROUND(SUM(t.amount), 2) AS total
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.transaction_type = 'expense'
          AND t.date >= '2026-03-01'
          AND t.date < '2026-04-01'
        GROUP BY c.name
        ORDER BY total DESC")
```
````

Press `Cmd+Shift+Return` and the results appear as an interactive table right next to your markdown. You can sort, filter, and browse — all without leaving your document.

#### Browse and Edit Transactions

You can also browse transactions interactively:

````markdown
```eelisp
;; Browse all uncategorized transactions
(open-db "/path/to/your/finance.db")

(browse
  (query "SELECT t.id, t.date, t.payee, t.description,
                t.amount, a.name AS account
          FROM transactions t
          LEFT JOIN accounts a ON t.account_id = a.id
          WHERE t.category_id IS NULL
          ORDER BY t.date DESC"))
```
````

This opens a navigable table view. You can scroll through your uncategorized transactions, see amounts and payees at a glance, and identify patterns worth turning into auto-categorization rules.

#### Quick Account Balances

For a dashboard-style summary:

````markdown
```eelisp
(open-db "/path/to/your/finance.db")

(browse
  (query "SELECT name, account_type, currency,
                ROUND(balance, 2) AS balance
          FROM accounts
          ORDER BY balance DESC"))
```
````

The point isn't that EEditor replaces FinanceTracker — it's that because your data is SQLite, you have **complete freedom** to analyze it however you want. Write custom reports. Build personal dashboards in markdown. Export to CSV for spreadsheets. The data is yours, in a format every tool understands.

Check out the [EEditor tutorial](https://eeditor.app/tutorial.html) for more on what's possible with EELisp code blocks, including defining custom tables, building forms, and creating reusable views.

## What's Next

FinanceTracker solves our problem. It might solve yours too. Here's how to try it:

- **Desktop app** (recommended): Download for free from the [GitHub releases](https://github.com/santacroce-tech/financetracker/releases). Click "Try Demo" to explore with sample data. When ready, create your own `.db` file and start importing your bank statements.

- **Web demo**: Visit [app.financetracker.pro](https://app.financetracker.pro) and log in with `demo` / `demo` to see the interface. This is a read-only showcase — don't put real data here.

- **Self-host**: Clone the [repo](https://github.com/santacroce-tech/financetracker), run `pip install -r requirements.txt && python app.py`, and you have a private instance in 30 seconds. Docker Compose is included too.

- **Explore your data**: Open your `.db` file in [EEditor](https://eeditor.app) and write EELisp queries to build custom reports, browse transactions, or analyze spending patterns — all inside markdown documents.

Everything is MIT licensed. No tracking, no analytics, no telemetry. Fork it, modify it, make it yours.

---

*FinanceTracker is built by [Santacroce Tech](https://roberto.santacroce.xyz). The source code is available on [GitHub](https://github.com/santacroce-tech/financetracker). The desktop app icon features a dollar sign because we're not subtle about what it does.*
