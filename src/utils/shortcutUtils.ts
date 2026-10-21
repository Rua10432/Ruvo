export type ShortcutScope = "global" | "editor" | "global-non-editing";
export type ShortcutCategory = "global" | "editor" | "insert";

export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: ShortcutCategory;
  defaultCombo: string;
  scope: ShortcutScope;
}

export const CATEGORY_LABELS: Record<ShortcutCategory, { label: string; description: string }> = {
  global: {
    label: "全局与视图",
    description: "控制窗口栏目折叠、全局检索、创建笔记以及打开设置等系统级操作",
  },
  editor: {
    label: "文本格式化",
    description: "正文编辑模式下的文本粗体、斜体、删除线、代码等快速样式切换",
  },
  insert: {
    label: "结构与插入",
    description: "文档结构块级元素插入，包括标题、待办清单、多选列表、代码块与图片",
  },
};

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // --- 全局与视图 (Global & Navigation) ---
  {
    id: "toggleLeftSidebar",
    name: "折叠/展开左侧栏",
    description: "切换文件资源管理器导航侧栏的展开与折叠",
    category: "global",
    defaultCombo: "Ctrl+B",
    scope: "global-non-editing",
  },
  {
    id: "toggleRightSidebar",
    name: "折叠/展开辅助栏",
    description: "切换右侧知识库双链与上下文辅助面板",
    category: "global",
    defaultCombo: "Ctrl+J",
    scope: "global",
  },
  {
    id: "newNote",
    name: "新建笔记",
    description: "在当前选中的笔记本中快速创建一篇新文档",
    category: "global",
    defaultCombo: "Ctrl+N",
    scope: "global",
  },
  {
    id: "search",
    name: "全局搜索",
    description: "聚焦并打开左侧栏全局笔记模糊检索框",
    category: "global",
    defaultCombo: "Ctrl+K",
    scope: "global-non-editing",
  },
  {
    id: "saveNote",
    name: "保存文档",
    description: "立即将当前编辑器改动持久化保存至本地磁盘",
    category: "global",
    defaultCombo: "Ctrl+S",
    scope: "global",
  },
  {
    id: "openSettings",
    name: "打开偏好设置",
    description: "呼出 Ruvo 系统设置与快捷键配置窗口",
    category: "global",
    defaultCombo: "Ctrl+,",
    scope: "global",
  },

  // --- 文本格式化 (Text Styles) ---
  {
    id: "bold",
    name: "粗体 (加粗)",
    description: "将光标处或选中文本切换为加粗强调样式",
    category: "editor",
    defaultCombo: "Ctrl+B",
    scope: "editor",
  },
  {
    id: "italic",
    name: "斜体",
    description: "将光标处或选中文本切换为斜体倾斜样式",
    category: "editor",
    defaultCombo: "Ctrl+I",
    scope: "editor",
  },
  {
    id: "strikethrough",
    name: "删除线",
    description: "为选中文本添加或移除删除线效果",
    category: "editor",
    defaultCombo: "Ctrl+Shift+X",
    scope: "editor",
  },
  {
    id: "inlineCode",
    name: "行内代码",
    description: "将选中内容格式化为行内等宽代码块",
    category: "editor",
    defaultCombo: "Ctrl+`",
    scope: "editor",
  },
  {
    id: "undo",
    name: "撤销",
    description: "撤销上一步编辑操作",
    category: "editor",
    defaultCombo: "Ctrl+Z",
    scope: "editor",
  },
  {
    id: "redo",
    name: "重做",
    description: "恢复上一步撤销的编辑操作",
    category: "editor",
    defaultCombo: "Ctrl+Y",
    scope: "editor",
  },

  // --- 结构与插入 (Insert & Blocks) ---
  {
    id: "link",
    name: "插入超链接",
    description: "为选中文本创建超链接或双向笔记引用",
    category: "insert",
    defaultCombo: "Ctrl+K",
    scope: "editor",
  },
  {
    id: "image",
    name: "插入本地图片",
    description: "弹出本地文件管理器选择并插入图片资源",
    category: "insert",
    defaultCombo: "Ctrl+Alt+I",
    scope: "editor",
  },
  {
    id: "codeBlock",
    name: "插入代码块",
    description: "在当前段落插入独立的多行语法高亮代码块",
    category: "insert",
    defaultCombo: "Ctrl+Alt+C",
    scope: "editor",
  },
  {
    id: "taskList",
    name: "待办清单",
    description: "切换或插入 Markdown 交互式复选框列表项",
    category: "insert",
    defaultCombo: "Ctrl+Alt+T",
    scope: "editor",
  },
  {
    id: "bulletList",
    name: "无序列表",
    description: "切换或插入项目符号无序列表项",
    category: "insert",
    defaultCombo: "Ctrl+Shift+U",
    scope: "editor",
  },
  {
    id: "numberedList",
    name: "有序列表",
    description: "切换或插入数字编号有序列表项",
    category: "insert",
    defaultCombo: "Ctrl+Shift+O",
    scope: "editor",
  },
  {
    id: "quote",
    name: "引用块",
    description: "切换或插入 Markdown 侧栏引用段落",
    category: "insert",
    defaultCombo: "Ctrl+Shift+Q",
    scope: "editor",
  },
];

export const DEFAULT_SHORTCUTS: Record<string, string> = Object.fromEntries(
  SHORTCUT_DEFINITIONS.map((def) => [def.id, def.defaultCombo])
);

export type KeyboardLikeEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

/**
 * Normalizes KeyboardEvent.key into a clean, displayable and comparable string.
 * Returns null if the pressed key is a modifier key alone.
 */
export function normalizeKey(event: KeyboardLikeEvent): string | null {
  const k = event.key;

  // Ignore standalone modifier presses
  if (k === "Control" || k === "Shift" || k === "Alt" || k === "Meta") {
    return null;
  }

  // Handle special and whitespace keys
  if (k === " ") return "Space";
  if (k === "Escape") return "Esc";

  // Arrow keys
  if (k === "ArrowUp") return "Up";
  if (k === "ArrowDown") return "Down";
  if (k === "ArrowLeft") return "Left";
  if (k === "ArrowRight") return "Right";

  // Single characters (letters) -> uppercase for uniform display/comparison
  if (k.length === 1) {
    if (k >= "a" && k <= "z") {
      return k.toUpperCase();
    }
    return k;
  }

  // Common keys like Enter, Tab, Backspace, Delete, F1-F12
  return k;
}

/**
 * Converts a KeyboardEvent to a canonical shortcut string, e.g. "Ctrl+Shift+K".
 * Returns null if only modifiers are pressed.
 */
export function eventToShortcutString(event: KeyboardLikeEvent): string | null {
  const key = normalizeKey(event);
  if (!key) return null;

  const parts: string[] = [];

  // Modifiers in canonical order: Ctrl, Alt, Shift, Meta
  if (event.ctrlKey || event.metaKey) {
    parts.push("Ctrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }

  parts.push(key);
  return parts.join("+");
}

export interface ParsedShortcut {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

/**
 * Parses a shortcut string like "Ctrl+Shift+K" into flags and key.
 */
export function parseShortcut(combo: string): ParsedShortcut | null {
  if (!combo || typeof combo !== "string") return null;

  const tokens = combo.split("+").map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return null;

  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let key = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      ctrl = true;
    } else if (lower === "alt") {
      alt = true;
    } else if (lower === "shift") {
      shift = true;
    } else if (lower === "meta" || lower === "cmd" || lower === "command" || lower === "win") {
      meta = true;
    } else {
      // Main key
      key = token;
    }
  }

  if (!key) return null;

  return { ctrl, alt, shift, meta, key };
}

/**
 * Tests whether a KeyboardEvent matches a configured shortcut string.
 */
export function matchesShortcut(event: KeyboardLikeEvent, combo: string | undefined): boolean {
  if (!combo) return false;
  const parsed = parseShortcut(combo);
  if (!parsed) return false;

  const eventHasCtrl = event.ctrlKey || event.metaKey;
  const requiresCtrl = parsed.ctrl || parsed.meta;

  if (eventHasCtrl !== requiresCtrl) return false;
  if (Boolean(event.altKey) !== parsed.alt) return false;
  if (Boolean(event.shiftKey) !== parsed.shift) return false;

  const eventKey = normalizeKey(event);
  if (!eventKey) return false;

  return eventKey.toLowerCase() === parsed.key.toLowerCase();
}

/**
 * Formats a shortcut string into an array of badge tokens, e.g. ["Ctrl", "Shift", "K"].
 */
export function formatShortcutDisplay(combo: string | undefined): string[] {
  if (!combo || typeof combo !== "string") {
    return ["未绑定"];
  }
  return combo.split("+").map((s) => s.trim()).filter(Boolean);
}

/**
 * Finds shortcut combinations that conflict within the same or overlapping scopes.
 * Returns a map of conflicting combo -> array of shortcut IDs.
 */
export function findShortcutConflicts(
  shortcuts: Record<string, string>
): Record<string, string[]> {
  const comboToDefs: Record<string, ShortcutDefinition[]> = {};

  for (const def of SHORTCUT_DEFINITIONS) {
    const combo = (shortcuts[def.id] || def.defaultCombo).trim().toLowerCase();
    if (!comboToDefs[combo]) {
      comboToDefs[combo] = [];
    }
    comboToDefs[combo].push(def);
  }

  const conflicts: Record<string, string[]> = {};

  for (const [combo, defs] of Object.entries(comboToDefs)) {
    if (defs.length <= 1) continue;

    // Check if there is an actual conflicting overlap.
    // Notice: an editor-only shortcut (e.g. bold: Ctrl+B) and a global-non-editing shortcut
    // (e.g. toggleLeftSidebar: Ctrl+B) is intentional context differentiation, NOT an invalid collision.
    const hasActiveCollision = defs.some((d1, i) =>
      defs.some((d2, j) => {
        if (i >= j) return false;
        // Same scope collision
        if (d1.scope === d2.scope) return true;
        // Both can trigger in the same context
        if (
          (d1.scope === "global" && d2.scope === "global") ||
          (d1.scope === "editor" && d2.scope === "editor") ||
          (d1.scope === "global" && d2.scope === "editor")
        ) {
          return true;
        }
        return false;
      })
    );

    if (hasActiveCollision) {
      conflicts[combo] = defs.map((d) => d.id);
    }
  }

  return conflicts;
}
