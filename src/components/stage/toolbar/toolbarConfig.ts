import React from "react";
import {
  Bold,
  CheckSquare,
  Code,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Undo,
} from "lucide-react";

export type HeadingType =
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6";

export type FormatAction =
  | "undo"
  | "redo"
  | "paragraph"
  | HeadingType
  | "bold"
  | "italic"
  | "link"
  | "image"
  | "table"
  | "code"
  | "code-block"
  | "bullet-list"
  | "numbered-list"
  | "task-list"
  | "quote"
  | "hr"
  | "strikethrough";

export type ActiveFormats = {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  code: boolean;
  codeBlock: boolean;
  link: boolean;
  bulletList: boolean;
  numberedList: boolean;
  taskList: boolean;
  quote: boolean;
  heading: HeadingType | null;
};

export const defaultActiveFormats: ActiveFormats = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  codeBlock: false,
  link: false,
  bulletList: false,
  numberedList: false,
  taskList: false,
  quote: false,
  heading: null,
};

export type ToolbarButtonGroup =
  | "history"
  | "heading"
  | "style"
  | "linkAndCode"
  | "codeBlock"
  | "list"
  | "misc";

export interface ToolbarItemConfig {
  action: FormatAction;
  label: string;
  tooltip: string;
  activeTooltip?: string;
  shortcut?: string;
  icon: React.ComponentType<any>;
  iconSize?: number;
  formatKey?: keyof Omit<ActiveFormats, "heading">;
  group?: ToolbarButtonGroup;
}

export interface HeadingOption {
  action: FormatAction;
  label: string;
  headingKey: HeadingType | null;
}

export const HEADING_OPTIONS: HeadingOption[] = [
  { action: "paragraph", label: "正文 (正常)", headingKey: null },
  { action: "heading-1", label: "1级标题", headingKey: "heading-1" },
  { action: "heading-2", label: "2级标题", headingKey: "heading-2" },
  { action: "heading-3", label: "3级标题", headingKey: "heading-3" },
  { action: "heading-4", label: "4级标题", headingKey: "heading-4" },
  { action: "heading-5", label: "5级标题", headingKey: "heading-5" },
  { action: "heading-6", label: "6级标题", headingKey: "heading-6" },
];

export const HEADING_LABELS: Record<HeadingType, string> = {
  "heading-1": "1级标题",
  "heading-2": "2级标题",
  "heading-3": "3级标题",
  "heading-4": "4级标题",
  "heading-5": "5级标题",
  "heading-6": "6级标题",
};

export const HISTORY_ITEMS: ToolbarItemConfig[] = [
  {
    action: "undo",
    label: "撤销",
    tooltip: "撤销",
    shortcut: "Ctrl+Z",
    icon: Undo,
    iconSize: 16,
    group: "history",
  },
  {
    action: "redo",
    label: "重做",
    tooltip: "重做",
    shortcut: "Ctrl+Y",
    icon: Redo,
    iconSize: 16,
    group: "history",
  },
];

export const BASIC_STYLE_ITEMS: ToolbarItemConfig[] = [
  {
    action: "bold",
    label: "加粗",
    tooltip: "加粗",
    activeTooltip: "取消加粗",
    shortcut: "Ctrl+B",
    icon: Bold,
    iconSize: 16,
    formatKey: "bold",
    group: "style",
  },
  {
    action: "italic",
    label: "斜体",
    tooltip: "斜体",
    activeTooltip: "取消斜体",
    shortcut: "Ctrl+I",
    icon: Italic,
    iconSize: 16,
    formatKey: "italic",
    group: "style",
  },
];

export const LINK_AND_CODE_ITEMS: ToolbarItemConfig[] = [
  {
    action: "link",
    label: "超链接",
    tooltip: "超链接",
    activeTooltip: "取消超链接",
    shortcut: "Ctrl+K",
    icon: Link,
    iconSize: 16,
    formatKey: "link",
    group: "linkAndCode",
  },
  {
    action: "image",
    label: "插入图片",
    tooltip: "插入图片 (Ctrl+Alt+I)",
    shortcut: "Ctrl+Alt+I",
    icon: ImageIcon,
    iconSize: 16,
    group: "linkAndCode",
  },
  {
    action: "table",
    label: "插入表格",
    tooltip: "插入表格",
    icon: TableIcon,
    iconSize: 16,
    group: "linkAndCode",
  },
  {
    action: "code",
    label: "行内代码",
    tooltip: "行内代码",
    activeTooltip: "取消行内代码",
    shortcut: "Ctrl+`",
    icon: Code,
    iconSize: 16,
    formatKey: "code",
    group: "linkAndCode",
  },
];

export const CODE_BLOCK_ITEM: ToolbarItemConfig = {
  action: "code-block",
  label: "代码块",
  tooltip: "代码块",
  activeTooltip: "退出代码块",
  shortcut: "Ctrl+Alt+C",
  icon: SquareCode,
  iconSize: 16,
  formatKey: "codeBlock",
  group: "codeBlock",
};

export const LIST_AND_QUOTE_ITEMS: ToolbarItemConfig[] = [
  {
    action: "task-list",
    label: "任务待办清单",
    tooltip: "任务待办清单",
    activeTooltip: "取消任务待办",
    shortcut: "Ctrl+Alt+T",
    icon: CheckSquare,
    iconSize: 16,
    formatKey: "taskList",
    group: "list",
  },
  {
    action: "bullet-list",
    label: "无序列表",
    tooltip: "无序列表",
    activeTooltip: "取消无序列表",
    shortcut: "Ctrl+Shift+U",
    icon: List,
    iconSize: 16,
    formatKey: "bulletList",
    group: "list",
  },
  {
    action: "numbered-list",
    label: "有序列表",
    tooltip: "有序列表",
    activeTooltip: "取消有序列表",
    shortcut: "Ctrl+Shift+O",
    icon: ListOrdered,
    iconSize: 16,
    formatKey: "numberedList",
    group: "list",
  },
  {
    action: "quote",
    label: "引用",
    tooltip: "引用",
    activeTooltip: "取消引用",
    shortcut: "Ctrl+Shift+Q",
    icon: Quote,
    iconSize: 16,
    formatKey: "quote",
    group: "list",
  },
];

export const MISC_ITEMS: ToolbarItemConfig[] = [
  {
    action: "hr",
    label: "分割线",
    tooltip: "分割线",
    icon: Minus,
    iconSize: 16,
    group: "misc",
  },
  {
    action: "strikethrough",
    label: "删除线",
    tooltip: "删除线",
    activeTooltip: "取消删除线",
    shortcut: "Ctrl+Shift+X",
    icon: Strikethrough,
    iconSize: 16,
    formatKey: "strikethrough",
    group: "misc",
  },
];
