# Changelog 📋

All notable changes to the **Ruvo** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-20

### 🚀 Initial Public Release

Ruvo is a portable, privacy-first, local-only Markdown notes desktop application built with **Tauri 2**, **React 19**, **TypeScript**, and **MDUI (Material Design 3)**.

### ✨ Features & Architectural Highlights

#### 📦 1. Portable-First & Data Sovereignty
- **True Green Software Architecture**: Notes are stored in standard `.md` files in folders located alongside the application executable—completely self-contained and easily backed up or transferred via flash drive.
- **Zero Cloud Dependence**: Fully functional offline with zero cloud accounts, telemetry, or remote server mandates.
- **Standard Markdown Interchange**: Transparent file structure compatible with Obsidian, VS Code, Typora, or standard Unix command line tools.

#### ✍️ 2. WYSIWYG Markdown Editing Canvas
- **NotebookLM Inspired Layout**: Clean, focused, centered 900px canvas designed for distraction-free writing.
- **GFM Syntax Support**: Real-time rendering and editing of Headings (H1–H6), bold, italic, strikethrough, blockquotes, ordered/unordered lists, horizontal rules, links, and inline/block code.
- **Bidirectional AST Serialization**: Handcrafted `domToMarkdown` serializer ensures clean, whitespace-normalized, lossless Markdown output without tag pollution or trailing empty lines.
- **CJK Font Synthesis**: Enabled CSS `font-synthesis` globally to solve missing native italic typefaces in Windows Chinese fonts (e.g. Microsoft YaHei).
- **5 Smart Format Exit Boundaries**:
  - `→` Arrow key to cleanly exit active inline formats at boundary.
  - `←` Arrow key to step out backwards before format starts.
  - `Space` at end of inline code pops out to body text with automatic spacing.
  - Smart toolbar / hotkey toggle at trailing edge preserves preceding text styling while disengaging cursor.
  - Zero-width anchors prevent mouse misclicks on trailing whitespace from accidentally entering inner inline elements.

#### 🎨 3. Material Design 3 & Desktop Layout
- **MDUI Web Components**: Rich Material 3 components with ripple animations, elevation levels, and design tokens.
- **Dual Themes**:
  - ☀️ **Arona (Light)**: Clean, serene daylight blue and white theme.
  - 🌙 **Plana (Dark)**: Subtle, deep night blue and neutral dark theme.
- **Three-Column Resizable Layout**:
  - **Left**: Activity Bar (48px) + collapsible Sidebar for Notebooks, search, and development roadmap.
  - **Center**: Tabbed editor stage with floating/docked toolbar and live document stats.
  - **Right**: Document Outline with real-time Scroll Spy and metadata panel.
- **Activity Bar State Machine**: VS Code-inspired toggle behavior—clicking the active tab collapses the sidebar; clicking an inactive tab switches panels and ensures it is expanded.
- **Windows 11 Native Integration**: Support for snap layouts, frameless window drag regions, and custom window controls.

#### 🧭 4. Outline Navigation & Document Tabs
- **Dynamic Outline Tree**: Automatically parses document headings into an interactive hierarchical tree.
- **Scroll Spy**: Synchronizes outline active state as the user scrolls through the document viewport.
- **Multi-Tab Document System**:
  - Tabs support dirty state detection with unsaved bullet indicator (`•`).
  - Smooth hover transitions to close button (`×`).
  - Safeguard confirmation modal before closing tabs with unsaved edits.
  - Context menu actions: close tab, close others, copy title.

#### 🔒 5. Rust Core Security & Atomic Operations
- **Atomic File Writing**: High-concurrency safe writes using atomic temp file replacement or `create_new` flags.
- **Strict Path Canonicalization**: Sanitizes user input paths, blocking directory traversal (`../`) and forbidden Windows file names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
- **XSS Mitigation**: Strict Content Security Policy (CSP) paired with DOMPurify sanitization.

#### 🔄 6. Auto-Updater & Settings Suite
- **Built-in Tauri v2 Updater**: Integrates Minisign digital signature verification and seamless asset downloads.
- **Live Update Progress**: In-app download progress indicator with byte-level precision.
- **Update Simulation Suite**: Interactive test mode allowing developers to preview update UX without spinning up a live release server.
- **Comprehensive Settings**: General preferences, theme selection, keyboard shortcuts guide, and About dialog.

#### 📜 7. Community & Open Source Infrastructure
- **GNU General Public License v3.0 (GPL-3.0)**: Fully open-source with strict copyleft protection ensuring user software freedoms.
- **Automated GitHub Actions CI/CD**: Release workflow (`.github/workflows/release.yml`) for automated builds and asset publishing.
- **Standard Documentation**: Added `CONTRIBUTING.md`, `SECURITY.md`, and this `CHANGELOG.md`.

---

[0.1.0]: https://github.com/Rua10432/Ruvo/releases/tag/v0.1.0
