# Contributing to Ruvo 🤝

Thank you for your interest in contributing to **Ruvo** (如安)! Ruvo is an open-source, portable, privacy-first local Markdown notes desktop application built with **Tauri 2**, **React 19**, **TypeScript**, and **MDUI (Material Design 3)**.

All contributions—whether reporting bugs, improving documentation, designing themes, or contributing code—are warmly welcomed.

---

## 📜 Code of Conduct & Principles

Ruvo is founded on key core tenets:
1. **Privacy & Data Sovereignty First**: All notes stay local. Ruvo has zero telemetry, zero forced cloud accounts, and zero non-local dependencies.
2. **Standard & Portable**: Markdown files are stored cleanly on disk without proprietary wrappers or database locks.
3. **Open Source Copyleft**: Ruvo is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. By contributing, you agree that your contributions will be licensed under GPL-3.0.

---

## 🛠️ Development Setup

### Prerequisites

Before you begin, ensure you have installed:
- **Node.js**: `>= 18.0.0` (LTS recommended, e.g., Node 20 or 22)
- **npm** (comes with Node.js)
- **Rust & Cargo**: `>= 1.77.0` (Install via [rustup.rs](https://rustup.rs/))
- **Windows Build Tools & WebView2**:
  - Microsoft C++ Build Tools (via Visual Studio Installer or Build Tools for Visual Studio)
  - Microsoft Edge WebView2 Evergreen Runtime (pre-installed on Windows 11 and modern Windows 10)
  - Detailed platform prerequisites can be found in the [Tauri 2 Prerequisites Guide](https://v2.tauri.app/start/prerequisites/).

### Clone & Install

```bash
git clone https://github.com/Rua10432/Ruvo.git
cd Ruvo
npm install
```

### Running in Development

- **Full Desktop App (Frontend + Tauri Rust Backend)**:
  ```bash
  npm run tauri dev
  ```
  This launches Vite on `http://localhost:1420` and spawns the native Tauri desktop window with hot reloading.

- **Frontend-Only Debugging** (in your browser):
  ```bash
  npm run dev
  ```
  Useful for quick UI styling, component tweaks, or layout adjustments.

- **Local Updater Mock Server**:
  ```bash
  npm run test:updater
  ```
  Starts a local mock updater server on `http://127.0.0.1:8080` to verify update notification and download flows.

### Verification & Building

- Run TypeScript type checks and production bundle:
  ```bash
  npm run build
  ```
- Build production release binaries (executables & installers):
  ```bash
  npm run tauri build
  ```
  Artifacts will be output to `src-tauri/target/release/`.

---

## 📁 Repository Structure

```text
Ruvo/
├── .github/workflows/         # CI/CD Release workflows
├── src/                       # Frontend application (React 19 + TypeScript)
│   ├── assets/                # App icons, static media
│   ├── components/
│   │   ├── layout/            # Window frame, AppLayout, StatusBar
│   │   ├── sidebar/           # Left activity panel, notebook tree, search view, roadmap
│   │   ├── stage/             # Central editor stage, TabBar, NotebookLM canvas, toolbar
│   │   ├── context/           # Right panel: Document Outline, metadata inspector
│   │   └── settings/          # Multi-tab settings dialog (General, Theme, Shortcuts, About)
│   ├── hooks/                 # Custom React hooks (useNotes, useNotebooks, useKeyboardShortcuts)
│   ├── services/              # Tauri IPC bridge (fileStore.ts, updaterService.ts)
│   ├── styles/                # MD3 theme tokens (Arona Light / Plana Dark), CSS variables
│   ├── types/                 # TypeScript interfaces and models
│   └── utils/                 # Markdown ↔ DOM bidirectional parser & format cleaners
├── src-tauri/                 # Backend desktop core (Rust + Tauri 2)
│   ├── src/
│   │   ├── main.rs            # Desktop binary bootstrap
│   │   ├── lib.rs             # Tauri command registry and handler dispatch
│   │   ├── notes.rs           # Disk I/O, notebook scanning, atomic note writing
│   │   └── security.rs        # Path canonicalization & directory traversal defense
│   ├── Cargo.toml             # Rust package manifest & dependencies
│   └── tauri.conf.json        # Tauri application config & update settings
├── LICENSE                    # GNU General Public License v3.0
├── CHANGELOG.md               # Version release notes
├── CONTRIBUTING.md            # Community contributor guide
└── SECURITY.md                # Security policy and vulnerability disclosure
```

---

## 🐛 Reporting Issues

### Bug Reports
Before opening an issue, please search existing issues to see if it has already been reported.

When filing a bug report, please include:
- A clear, descriptive title.
- Clear steps to reproduce the problem.
- Expected vs. actual behavior.
- Operating system version (e.g. Windows 11 Build 22631, Windows 10 22H2).
- Ruvo version (e.g. `v0.1.0`).
- Console output or screenshots if applicable.

### Feature Requests
Feature suggestions are welcome! Please make sure that:
- The proposal aligns with Ruvo's local-first, privacy-respecting design principles.
- You describe the problem and use case you are trying to solve, not just the proposed solution.

---

## 🔀 Submitting Pull Requests (PRs)

1. **Fork the repository** to your GitHub account.
2. **Create a topic branch** from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   # or
   git checkout -b fix/issue-description
   ```
3. **Commit your changes**:
   - Follow [Conventional Commits](https://www.conventionalcommits.org/):
     - `feat:` A new user-facing feature
     - `fix:` A bug fix
     - `docs:` Documentation improvements
     - `style:` Formatting or UI styling changes without logic impact
     - `refactor:` Code restructuring without feature addition or bug fix
     - `perf:` Performance improvements
     - `test:` Adding or updating tests
     - `chore:` Build scripts or maintenance tasks
4. **Verify your build**:
   ```bash
   npm run build
   ```
   Ensure there are zero TypeScript compiler errors and bundle issues.
5. **Push to your fork** and submit a Pull Request targeting the `main` branch.
6. Provide a concise explanation of what the PR accomplishes and link any related issues.

---

## ⚖️ License

By submitting code or documentation to Ruvo, you acknowledge that your contribution will be licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
