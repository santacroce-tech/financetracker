# FinanceTracker Desktop App

A fully offline desktop finance tracker built with Tauri v2, React, and Rust. No account or server required. Users choose a local SQLite file to store their data.

- Platforms: Windows, macOS, Linux
- Languages: English, Portuguese (Brazil), Spanish

## Prerequisites

- **Node.js** 20+
- **Rust** toolchain — install via [rustup](https://rustup.rs/)

### Platform-Specific Dependencies

**Linux (Debian/Ubuntu):**

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev
```

**macOS:**

```bash
xcode-select --install
```

**Windows:**

- [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (included in Windows 11; install manually on Windows 10)

## Development

```bash
cd desktop
npm install
npm run tauri dev
```

This starts the app with hot reload for both the React frontend and the Rust backend.

## Building for Production

```bash
npm run tauri build
```

Build output by platform:

| Platform | Output |
|---|---|
| macOS | `src-tauri/target/release/bundle/dmg/*.dmg` |
| Windows | `src-tauri/target/release/bundle/msi/*.msi` |
| Linux | `src-tauri/target/release/bundle/appimage/*.AppImage`, `deb/*.deb` |

### macOS Universal Binary

To build a universal binary supporting both Apple Silicon and Intel:

```bash
npm run tauri build -- --target universal-apple-darwin
```

## Project Structure

```
desktop/
├── src/                  # React frontend
│   ├── components/
│   ├── pages/
│   └── i18n/             # Translation files
│       ├── en.json
│       ├── pt-BR.json
│       ├── es.json
│       └── index.js
├── src-tauri/            # Rust backend
│   ├── src/
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.js
```

## Demo Database

A bundled `demo.db` file is included with sample transactions, categories, and budgets for testing.

To regenerate the demo database:

```bash
python scripts/generate_demo.py
```

## CI/CD

The GitHub Actions workflow at `.github/workflows/desktop-build.yml` handles automated builds and releases.

- **Trigger:** Push a tag matching `desktop-v*` (e.g., `desktop-v1.0.0`)
- **Builds:** Linux (AppImage, .deb), Windows (.msi), macOS (.dmg)
- **Output:** Creates a draft GitHub release with all platform binaries attached

To create a release:

```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

## Adding Translations

1. Copy `src/i18n/en.json` to a new file (e.g., `fr.json`).
2. Translate all string values.
3. Register the new locale in `src/i18n/index.js`.
