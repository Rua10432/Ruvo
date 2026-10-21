# Ruvo 📝

> **A minimalist, portable, and privacy-first local Markdown second brain.**  
> 隐私优先、数据自主、完全离线、所见即所得。基于 **Tauri 2 + Rust + React 19 + TypeScript + MDUI (Material Design 3)** 打造，具备 NotebookLM 风格沉浸式居中画布、[[双向链接]]与零云端绑定。

[![GitHub Repo](https://img.shields.io/badge/GitHub-Rua10432%2FRuvo-181717.svg?logo=github)](https://github.com/Rua10432/Ruvo)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v0.1.0-brightgreen.svg)](CHANGELOG.md)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app/)
[![React](https://img.shields.io/badge/React-v19-61dafb.svg)](https://react.dev/)

---

## 🌟 核心特性 (Key Features)

### 📦 1. 便携式存储与数据自主 (Portable First)
- **绿色便携架构**：笔记直接保存在应用程序可执行文件（`Ruvo.exe`）同级目录下，随拷随走，无需外部数据库或复杂的配置文件。
- **纯粹标准 Markdown**：所有笔记均以原生的 `.md` 格式文件存储在各笔记本子文件夹中，完全开放兼容，随时可用 VS Code、Obsidian 或任意文本编辑器直接打开与迁移。
- **完全离线与零在线依赖**：不依赖任何云端同步、第三方账户系统或外部 CDN 资源，杜绝隐私泄漏风险。

### ✍️ 2. 所见即所得编辑画布 (WYSIWYG Markdown Canvas)
- **NotebookLM 风格居中画布**：最大宽度 900px，优化的行高与字偶距排版，带来专注且沉浸的写作体验。
- **丰富的 GFM 语法支持**：
  - H1 ~ H6 多级标题
  - 粗体（Bold）、斜体（Italic）、删除线（Strikethrough）
  - 行内代码（Inline Code）、多行独立代码块（Code Block）
  - 引用块（Blockquote）、有序列表（OL）、无序列表（UL）、水平分割线（HR）
  - 超链接（Link）快速插入与弹窗编辑
- **中文字体合成（Font Synthesis）**：全局启用 `font-synthesis`，完美解决 Windows 平台微软雅黑等字体无原生斜体字型导致无法正常显示斜体的问题。
- **双向无损转换与格式清洗**：定制化 [`domToMarkdown`](src/utils/domToMarkdown.ts) 序列化引擎，自动处理语法边界空白，并在保存时智能剥离内部占位字符，生成干净规整的 Markdown 文本。

### 🛡️ 3. 彻底杜绝格式污染与平滑脱离机制
针对富文本排版中常见的行内格式粘滞与污染问题，内置全方位的边界隔离与脱离能力：
- **5 种退出格式交互**：
  1. **方向键跨越**：在行内格式末尾按 `→`（右方向键）平滑跳出当前格式，后续输入恢复为正文。
  2. **反向跳出**：在格式开头按 `←`（左方向键）跳出至格式前方。
  3. **代码空格脱离**：在行内代码末尾敲击 `Space` 空格键自动跳出行内代码并在正文中插入空格（支持 `Shift + Space` 在代码内键入空格）。
  4. **工具栏反向切换**：在格式末尾点击高亮激活态的格式按钮（或按对应快捷键 `Ctrl+B` / `Ctrl+I`），**保留前面已排版的文字**，仅让光标脱离该格式环境。
  5. **鼠标落点保护**：段落末尾带有行内元素时自动维护零宽边界锚点，鼠标点击右侧空白区域绝不会误入行内标签内部。

### 🎨 4. 垂直活动栏与 Material Design 3 设计美学
- **48px 独立垂直活动栏 (Activity Bar)**：
  - 位于窗口最左侧，包含笔记工作区（Notes）导航入口。
  - 具备 VS Code 风格的智能交互：点击当前激活项快速折叠侧栏，点击非激活项平滑切换视图并自动展开。
  - 底部集成系统设置（Settings）面板快捷入口与 Arona / Plana 专属双主题一键平滑切换。
- **MDUI Web Components 深度集成**：遵循最新的 Material 3 设计规范，具有柔和圆角、精致状态层与动效过渡。
- **双主题即时切换**：
  - ☀️ **Arona (亮色模式)**：清爽澄澈的蓝白天蓝基调。
  - 🌙 **Plana (暗色模式)**：深邃低饱和的灰蓝暗夜基调。
- **三栏可拖拽桌面布局**：
  - 左侧：笔记本切换、即时全文搜索与笔记列表管理。
  - 中间：多标签页管理与所见即所得核心编辑区。
  - 右侧：文档结构大纲与双链反向链接面板。
  - 左右侧栏均支持鼠标拖拽自由调节宽度，支持一键折叠收起。

### 🧭 5. 智能大纲与双向滚动联动 (Outline & Scroll Spy)
- **多级大纲实时提取**：自动解析正文标题层级（H1~H6），构建树状大纲导航。
- **折叠展开与视觉分层**：父级大纲与子级大纲采用差异化胶囊尺寸与缩进，支持一键折叠子层级。
- **视口滚动监听（Scroll Spy）**：阅读与滚动正文时，右侧大纲高亮项实时跟随视口正文所处章节。
- **平滑定位与视口边距**：点击大纲项平滑平移至对应正文位置，配置 `scroll-margin-top` 避免标题被顶部工具栏遮挡。

### 📑 6. 生产级多标签页系统 (TabBar & NoteTabs)
- **多文档随开随切**：支持同时打开多篇笔记进行比对与编辑。
- **VS Code 式未保存状态感知**：
  - 存在未保存变更时，标签右侧显示常驻未保存小圆点（•）。
  - 鼠标悬停时平滑变为关闭按钮（×）。
  - 关闭未保存标签页时自动触发 Material 确认弹窗，防止误操作丢失内容。
- **便捷右键操作**：支持复制笔记名称、一键关闭其他所有标签页等。

### 🔒 7. 坚固的 Rust 后端安全机制
- **原子性保存与防冲突**：后端新建笔记采用 `create_new` 原子写入，彻底杜绝并发覆盖风险。
- **严格路径白名单与防逃逸**：基于 `canonicalize` 验证并限制所有文件读写均局限在应用工作区子目录下，抵御路径穿越与符号链接攻击。

---

## ⌨️ 常用快捷键 (Shortcuts)

| 快捷键 (Windows / macOS) | 作用 |
| :--- | :--- |
| `Ctrl + S` / `Cmd + S` | 保存当前笔记至本地磁盘 |
| `Ctrl + B` / `Cmd + B` | 切换左侧边栏展开/折叠（选中文本时为加粗） |
| `Ctrl + J` / `Cmd + J` | 切换右侧大纲栏展开/折叠 |
| `Ctrl + I` / `Cmd + I` | 选中文本切换斜体 |
| `Tab` | 编辑区智能插入 4 空格缩进 |
| `Enter` (代码块内) | 在代码块内部插入换行，不破坏代码块结构 |
| `→` / `←` (格式边缘) | 平滑步入 / 步出当前行内格式（代码、加粗、斜体等） |
| `Space` (行内代码末尾) | 自动脱离行内代码并插入空格 |
| `Shift + Space` (行内代码内) | 在行内代码内部强制输入空格 |

---

## 🛠️ 技术栈 (Tech Stack)

### 前端 (Frontend)
- **核心框架**：[React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**：[Vite 8](https://vitejs.dev/)
- **UI 组件库**：[MDUI 2.1](https://www.mdui.org/) (基于 Web Components 的 Material 3 设计系统)
- **图标库**：[Lucide React](https://lucide.dev/) + Material Symbols
- **布局引擎**：[react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- **Markdown 解析与消毒**：[Marked 18](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify)

### 后端 (Desktop Backend)
- **核心框架**：[Tauri 2](https://v2.tauri.app/)
- **系统语言**：[Rust 2021 Edition](https://www.rust-lang.org/)
- **本地 API**：Tauri Plugin Opener, 标准文件系统 I/O, 安全路径规范化引擎

---

## 📁 目录结构 (Directory Structure)

```text
Ruvo/
├── src-tauri/                 # Tauri 2 后端 (Rust)
│   ├── src/
│   │   ├── main.rs            # 桌面应用程序入口
│   │   ├── lib.rs             # Tauri 命令注册与主调度
│   │   ├── notes.rs           # 笔记本扫描、笔记读写与原子更新
│   │   └── security.rs        # 路径规范化校验与保留名防逃逸检查
│   ├── Cargo.toml             # Rust 依赖声明
│   └── tauri.conf.json        # Tauri 窗口与安全配置
├── src/                       # 前端源码 (React + TypeScript)
│   ├── assets/                # 静态资源
│   ├── components/
│   │   ├── layout/            # 整体布局 (AppLayout, StatusBar)
│   │   ├── sidebar/           # 左侧栏 (笔记本切换, 笔记搜索与列表)
│   │   ├── stage/             # 主编辑舞台 (MainStage, TabBar, NotebookLMEditor, StageToolbar)
│   │   └── context/           # 右侧栏 (大纲树 OutlineList, 元数据)
│   ├── hooks/                 # 业务 Hooks (useNotes, useNotebooks, useKeyboardShortcuts)
│   ├── services/              # Tauri Invoke IPC 包装层 (fileStore.ts)
│   ├── styles/                # Material 3 全局设计令牌与基础样式
│   ├── types/                 # 全局 TypeScript 类型定义
│   └── utils/                 # DOM/Markdown 序列化与解析工具
├── HANDOFF.md                 # 项目详细技术交接说明
├── package.json               # Node 依赖与构建脚本
└── vite.config.ts             # Vite 构建配置
```

---

## 🚀 快速上手 (Getting Started)

### 前置环境需求
- **Node.js**：`>= 18.0.0`
- **npm** 或 **pnpm**
- **Rust & Cargo**：`>= 1.77.0` (可通过 [rustup.rs](https://rustup.rs/) 安装)
- **Tauri 系统前置依赖**：参考 [Tauri 2 Prerequisites](https://v2.tauri.app/start/prerequisites/)（Windows 需具备 C++ 生成工具与 WebView2）

### 克隆与安装依赖
```bash
git clone https://github.com/Rua10432/Ruvo.git
cd Ruvo
npm install
```

### 启动开发模式
运行桌面端开发环境（会自动启动 Vite 前端服务并拉起 Tauri 桌面原生窗口）：
```bash
npm run tauri dev
```

如仅需快速调试纯前端 UI（无 Rust 后端本地文件系统交互）：
```bash
npm run dev
```

### 构建打包
编译 TypeScript 并构建发布版可执行文件：
```bash
npm run build        # 前端编译与类型校验
npm run tauri build  # 构建各平台独立发布包 (如 Ruvo.exe / 安装包)
```

打包完成后，产物将生成在 `src-tauri/target/release/` 目录下。

---

## 📄 开源许可 (License)

本项目遵循 [GNU General Public License v3.0 (GPL-3.0)](LICENSE) 协议开源。

Copyright (C) 2026 Ruvo Contributors.

您可以自由使用、修改与分发本软件。任何包含或衍生自本软件的代码也必须在相同的 GPL-3.0 协议下开源。详情请参阅项目根目录下的 [LICENSE](LICENSE) 文件。

---

## 🤝 社区与贡献 (Community & Contributing)

- 欢迎提交 Issue 和 Pull Request，参与规则请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全漏洞通报与报告指引请查看 [SECURITY.md](SECURITY.md)。
- 详细版本发布与更新日志请查看 [CHANGELOG.md](CHANGELOG.md)。
