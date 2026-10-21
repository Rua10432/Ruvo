import React from "react";
import type { FormatAction } from "../StageToolbar";
import { getSettings } from "../../settings/settingsStore";
import { matchesShortcut, DEFAULT_SHORTCUTS } from "../../../utils/shortcutUtils";
import {
  getClosestInlineFormatElement,
  getLastTextNode,
  isCursorAtEndOfInline,
  isCursorAtStartOfInline,
  stepOutBeforeInline,
  stepOutOfInline,
} from "./editorFormatters";

export interface EditorKeyboardOptions {
  editor: HTMLElement;
  onFormat: (action: FormatAction) => void;
  onSave?: () => void;
  onInput: () => void;
  emitFormatState: () => void;
  flushPending: () => void;
  savedSelectionRef?: React.MutableRefObject<Range | null>;
}

/**
 * Pure event handling for keyboard shortcuts and structural navigation:
 * - Tab/Shift+Tab cell navigation and dynamic row insertion in markdown tables
 * - Indentation tabs
 * - Backspace on image boundary or inline format boundary
 * - Arrow navigation out of inline boundaries (code, bold, italic, etc.)
 * - Shift+Space & Space handling inside and at end of inline code
 * - Enter inside <pre> codeblocks & task-list-items
 * - Standard shortcuts: Ctrl/Cmd+S (save), Ctrl/Cmd+B (bold), Ctrl/Cmd+I (italic), Ctrl+Alt+I (image)
 */
export function handleEditorKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  options: EditorKeyboardOptions
): void {
  const { editor, onFormat, onSave, onInput, emitFormatState, flushPending, savedSelectionRef } = options;

  if (event.key === "Tab") {
    const sel = window.getSelection();
    let currentCell: HTMLTableCellElement | null = null;
    if (sel && sel.rangeCount > 0) {
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const targetEl =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as HTMLElement)
          : node.parentElement;
      currentCell = (targetEl?.closest("th, td") as HTMLTableCellElement) || null;
      if (currentCell && !editor.contains(currentCell)) {
        currentCell = null;
      }
    }

    if (currentCell) {
      event.preventDefault();
      const table = currentCell.closest("table");
      if (!table) return;

      const allCells = Array.from(table.querySelectorAll("th, td")) as HTMLElement[];
      const currentIndex = allCells.indexOf(currentCell);
      if (currentIndex === -1) return;

      const focusCell = (cell: HTMLElement) => {
        const newRange = document.createRange();
        newRange.selectNodeContents(cell);
        if (!cell.textContent?.trim()) {
          newRange.collapse(true);
        }
        const curSel = window.getSelection();
        if (curSel) {
          curSel.removeAllRanges();
          curSel.addRange(newRange);
          if (savedSelectionRef) {
            savedSelectionRef.current = newRange.cloneRange();
          }
        }
        cell.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      };

      if (event.shiftKey) {
        // Shift+Tab: Move focus to previous cell
        if (currentIndex > 0) {
          const prevCell = allCells[currentIndex - 1];
          focusCell(prevCell);
          emitFormatState();
        }
      } else {
        // Tab (without Shift): Move focus to next cell or append new row if at last cell in tbody
        const tbody = table.querySelector("tbody") || table;
        const tbodyRows = Array.from(tbody.querySelectorAll("tr"));
        const lastTbodyRow = tbodyRows[tbodyRows.length - 1];
        const isLastCellInTbody =
          lastTbodyRow &&
          lastTbodyRow.contains(currentCell) &&
          currentCell === lastTbodyRow.lastElementChild;

        if (isLastCellInTbody || currentIndex === allCells.length - 1) {
          const headerRow = table.querySelector("thead tr") || table.querySelector("tr");
          const colCount = headerRow ? headerRow.children.length : currentCell.parentElement?.children.length || 3;

          const newTr = document.createElement("tr");
          for (let i = 0; i < colCount; i++) {
            const td = document.createElement("td");
            td.innerHTML = "<br>";
            newTr.appendChild(td);
          }

          if (table.querySelector("tbody")) {
            table.querySelector("tbody")!.appendChild(newTr);
          } else {
            table.appendChild(newTr);
          }

          const firstTd = newTr.firstElementChild as HTMLElement;
          if (firstTd) {
            focusCell(firstTd);
          }
          onInput();
          emitFormatState();
        } else {
          const nextCell = allCells[currentIndex + 1];
          if (nextCell) {
            focusCell(nextCell);
            emitFormatState();
          }
        }
      }
      return;
    }

    event.preventDefault();
    document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
    onInput();
    return;
  }

  const settings = getSettings();
  const shortcuts = settings.shortcuts || DEFAULT_SHORTCUTS;

  if (matchesShortcut(event, shortcuts.saveNote)) {
    event.preventDefault();
    flushPending();
    onSave?.();
    return;
  }

  if (matchesShortcut(event, shortcuts.bold)) {
    event.preventDefault();
    onFormat("bold");
    return;
  }

  if (matchesShortcut(event, shortcuts.image)) {
    event.preventDefault();
    onFormat("image");
    return;
  }

  if (matchesShortcut(event, shortcuts.italic)) {
    event.preventDefault();
    onFormat("italic");
    return;
  }

  if (matchesShortcut(event, shortcuts.strikethrough)) {
    event.preventDefault();
    onFormat("strikethrough");
    return;
  }

  if (matchesShortcut(event, shortcuts.inlineCode)) {
    event.preventDefault();
    onFormat("code");
    return;
  }

  if (matchesShortcut(event, shortcuts.codeBlock)) {
    event.preventDefault();
    onFormat("code-block");
    return;
  }

  if (matchesShortcut(event, shortcuts.link)) {
    event.preventDefault();
    onFormat("link");
    return;
  }

  if (matchesShortcut(event, shortcuts.taskList)) {
    event.preventDefault();
    onFormat("task-list");
    return;
  }

  if (matchesShortcut(event, shortcuts.bulletList)) {
    event.preventDefault();
    onFormat("bullet-list");
    return;
  }

  if (matchesShortcut(event, shortcuts.numberedList)) {
    event.preventDefault();
    onFormat("numbered-list");
    return;
  }

  if (matchesShortcut(event, shortcuts.quote)) {
    event.preventDefault();
    onFormat("quote");
    return;
  }

  if (matchesShortcut(event, shortcuts.undo)) {
    event.preventDefault();
    onFormat("undo");
    return;
  }

  if (matchesShortcut(event, shortcuts.redo)) {
    event.preventDefault();
    onFormat("redo");
    return;
  }

  // Enter inside <pre><code>: insert a newline instead of splitting <pre>
  if (event.key === "Enter" && !event.shiftKey) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const inPre =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement).closest("pre")
          : range.commonAncestorContainer.parentElement?.closest("pre");
      if (inPre) {
        event.preventDefault();
        document.execCommand("insertLineBreak");
        onInput();
        return;
      }

      const targetEl =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement)
          : range.commonAncestorContainer.parentElement;
      const taskLi = targetEl?.closest("li") as HTMLElement | null;
      if (taskLi && (taskLi.classList.contains("task-list-item") || taskLi.querySelector('input[type="checkbox"]'))) {
        const rawText = taskLi.textContent?.replace(/[\u200B\uFEFF]/g, "").trim() || "";
        if (!rawText) {
          event.preventDefault();
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          const parentUl = taskLi.closest("ul");
          if (parentUl && parentUl.children.length === 1) {
            parentUl.replaceWith(p);
          } else {
            taskLi.remove();
            parentUl?.after(p);
          }
          const newRange = document.createRange();
          newRange.setStart(p, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          onInput();
          return;
        } else {
          event.preventDefault();
          const newLi = document.createElement("li");
          newLi.className = "task-list-item";
          const newCb = document.createElement("input");
          newCb.type = "checkbox";
          newCb.setAttribute("contenteditable", "false");
          const spaceNode = document.createTextNode(" ");
          newLi.appendChild(newCb);
          newLi.appendChild(spaceNode);
          taskLi.after(newLi);

          const newRange = document.createRange();
          newRange.setStart(spaceNode, 1);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          onInput();
          return;
        }
      }
    }
  }

  // Inline format navigation & escaping (code, bold, italic, strikethrough, link):
  // 1. ArrowRight at end of inline format -> step out after element
  if (
    event.key === "ArrowRight" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const inlineEl = getClosestInlineFormatElement(
        range.startContainer,
        editor,
        range.startOffset
      );
      if (inlineEl && isCursorAtEndOfInline(inlineEl, sel)) {
        event.preventDefault();
        stepOutOfInline(inlineEl, sel);
        emitFormatState();
        return;
      }
    }
  }

  // 2. ArrowLeft at start of inline format -> step out before element
  if (
    event.key === "ArrowLeft" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const inlineEl = getClosestInlineFormatElement(
        range.startContainer,
        editor,
        range.startOffset
      );
      if (inlineEl && isCursorAtStartOfInline(inlineEl, sel)) {
        event.preventDefault();
        stepOutBeforeInline(inlineEl, sel);
        emitFormatState();
        return;
      }
    }
  }

  // 3. Shift + Space inside inline code -> insert a space inside code
  if (
    event.key === " " &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const inlineEl = getClosestInlineFormatElement(
        range.startContainer,
        editor,
        range.startOffset
      );
      if (inlineEl && inlineEl.tagName.toLowerCase() === "code") {
        event.preventDefault();
        document.execCommand("insertText", false, " ");
        onInput();
        emitFormatState();
        return;
      }
    }
  }

  // 4. Space at end of inline code -> escape code and insert space outside
  if (
    event.key === " " &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const inlineEl = getClosestInlineFormatElement(
        range.startContainer,
        editor,
        range.startOffset
      );
      if (
        inlineEl &&
        inlineEl.tagName.toLowerCase() === "code" &&
        isCursorAtEndOfInline(inlineEl, sel)
      ) {
        event.preventDefault();
        stepOutOfInline(inlineEl, sel, "\u00A0");
        onInput();
        emitFormatState();
        return;
      }
    }
  }

  // 5. Backspace right after inline format or img in \u200B anchor
  if (
    event.key === "Backspace" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.startsWith("\u200B")) {
        const prev = node.previousSibling;
        if (prev && prev.nodeType === Node.ELEMENT_NODE) {
          const el = prev as HTMLElement;
          if (el.tagName.toLowerCase() === "img") {
            if (range.startOffset <= 1) {
              event.preventDefault();
              el.remove();
              node.textContent = node.textContent.slice(1);
              onInput();
              emitFormatState();
              return;
            }
          }
          if (getClosestInlineFormatElement(prev, editor)) {
            if (range.startOffset <= 1) {
              event.preventDefault();
              node.textContent = node.textContent.slice(1);
              const lastText = getLastTextNode(prev);
              if (lastText) {
                const newRange = document.createRange();
                newRange.setStart(lastText, lastText.textContent?.length || 0);
                newRange.setEnd(lastText, lastText.textContent?.length || 0);
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
              emitFormatState();
              return;
            }
          }
        }
      }
    }
  }
}
