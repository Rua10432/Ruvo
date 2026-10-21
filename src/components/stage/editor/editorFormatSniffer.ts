import {
  type ActiveFormats,
  defaultActiveFormats,
  type HeadingType,
} from "../StageToolbar";

export type FormatState = {
  hasSelection: boolean;
  activeFormats: ActiveFormats;
};

/**
 * Pure logic: Detect active formatting states based on native document.queryCommandState
 * and an O(1) ancestor chain walk up from the current selection (depth <= 12).
 * Strictly avoids full DOM traversal (querySelectorAll).
 */
export function detectActiveFormats(editor: HTMLElement, range: Range): ActiveFormats {
  const formats: ActiveFormats = { ...defaultActiveFormats };

  // 1. Browser native command states
  try {
    formats.bold = document.queryCommandState("bold");
  } catch {}
  try {
    formats.italic = document.queryCommandState("italic");
  } catch {}
  try {
    formats.strikethrough = document.queryCommandState("strikeThrough");
  } catch {}
  try {
    formats.bulletList = document.queryCommandState("insertUnorderedList");
  } catch {}
  try {
    formats.numberedList = document.queryCommandState("insertOrderedList");
  } catch {}

  // 2. Fast O(1) ancestor chain walk: inspect nodes up to editor
  const inspectAncestors = (startNode: Node | null) => {
    let el: HTMLElement | null =
      startNode?.nodeType === Node.ELEMENT_NODE
        ? (startNode as HTMLElement)
        : startNode?.parentElement ?? null;

    let depth = 0;
    while (el && el !== editor && editor.contains(el) && depth < 12) {
      const tag = el.tagName.toLowerCase();

      if (tag === "code") {
        if (el.closest("pre")) {
          formats.codeBlock = true;
        } else {
          formats.code = true;
        }
      } else if (tag === "pre") {
        formats.codeBlock = true;
      } else if (tag === "blockquote") {
        formats.quote = true;
      } else if (tag === "a") {
        formats.link = true;
      } else if (tag === "b" || tag === "strong") {
        formats.bold = true;
      } else if (tag === "i" || tag === "em") {
        formats.italic = true;
      } else if (tag === "s" || tag === "del" || tag === "strike") {
        formats.strikethrough = true;
      } else if (tag === "ul") {
        if (el.classList.contains("task-list") || el.querySelector('input[type="checkbox"]')) {
          formats.taskList = true;
        } else {
          formats.bulletList = true;
        }
      } else if (tag === "li") {
        if (el.classList.contains("task-list-item") || el.querySelector('input[type="checkbox"]')) {
          formats.taskList = true;
        }
      } else if (tag === "ol") {
        formats.numberedList = true;
      } else if (/^h[1-6]$/.test(tag)) {
        if (!formats.heading) {
          formats.heading = `heading-${tag[1]}` as HeadingType;
        }
      }

      if (!formats.bold) {
        const style = el.getAttribute("style") || "";
        if (/font-weight\s*:\s*(bold|[6-9]\d{2}|1000)/i.test(style)) {
          formats.bold = true;
        }
      }
      if (!formats.italic) {
        const style = el.getAttribute("style") || "";
        if (/font-style\s*:\s*italic/i.test(style)) {
          formats.italic = true;
        }
      }

      el = el.parentElement;
      depth++;
    }
  };

  inspectAncestors(range.commonAncestorContainer);
  if (!range.collapsed) {
    inspectAncestors(range.startContainer);
  }

  return formats;
}

/**
 * Pure logic: Inspect editor selection to construct full FormatState.
 */
export function getActiveFormats(editor: HTMLElement | null): FormatState {
  if (!editor) {
    return { hasSelection: false, activeFormats: { ...defaultActiveFormats } };
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { hasSelection: false, activeFormats: { ...defaultActiveFormats } };
  }

  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return { hasSelection: false, activeFormats: { ...defaultActiveFormats } };
  }

  const hasSelection = !sel.isCollapsed && sel.toString().trim().length > 0;
  const activeFormats = detectActiveFormats(editor, range);

  return { hasSelection, activeFormats };
}
