# FinanceTracker

A fast, fully offline personal finance desktop app for Windows, macOS and Linux — built with Tauri v2, React and Rust. No account, no server: your data lives in a local SQLite file you choose.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Multi-account support** — checking, savings, credit cards, cash, investments
- **Transactions** — add, edit, delete and search
- **CSV import** — map columns, pick the separator (comma, semicolon, tab, pipe, or auto-detect), choose the date format; European and US amounts are both understood (`-10,00`, `1.234,56`, `1,234.56`, `-10,00 €`, …)
- **Categories, rules and budgets** — auto-categorize recurring payees and track spending against budgets
- **Keyboard-driven clearing** — fly through uncategorized transactions with the keyboard
- **Reports & charts** — spending analysis and monthly trends
- **Languages** — English, Portuguese (Brazil), Spanish
- **Demo database** bundled so you can try it instantly

## Getting Started

Download the installer for your platform from the [latest release](https://github.com/santacroce-tech/financetracker/releases/latest), or build from source:

```bash
cd desktop
npm install
npm run tauri dev     # development with hot reload
npm run tauri build   # production installers
```

See [`desktop/README.md`](desktop/README.md) for prerequisites, build outputs, CI/CD, releases and code signing.

## Tech Stack

- **Shell**: Tauri v2 (Rust)
- **Backend**: Rust + rusqlite (bundled SQLite)
- **Frontend**: React 18, Vite, Bootstrap 5, Chart.js
- **i18n**: react-i18next (EN, PT-BR, ES)
- **Platforms**: Windows (.msi, .exe), macOS (.dmg), Linux (.AppImage, .deb, .rpm)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push the branch and open a Pull Request

## License

MIT — see [LICENSE](LICENSE).
