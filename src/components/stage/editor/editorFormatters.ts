import { convertFileSrc } from "@tauri-apps/api/core";
import type { FormatAction, HeadingType } from "../StageToolbar";

/**
 * Returns the deepest last text node within a subtree.
 */
export function getLastTextNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node;
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const text = getLastTextNode(node.childNodes[i]);
    if (text) return text;
  }
  return null;
}

/**
 * Finds the closest inline formatting ancestor (code, strong, b, em, i, del, s, strike, a).
 */
export function getClosestInlineFormatElement(
  node: Node | null,
  editor: HTMLElement,
  offset?: number
): HTMLElement | null {
  if (!node) return null;

  if (node.nodeType === Node.ELEMENT_NODE && typeof offset === "number") {
    const elContainer = node as HTMLElement;
    if (offset > 0 && offset <= elContainer.childNodes.length) {
      const prevChild = elContainer.childNodes[offset - 1];
      const prevInline = getClosestInlineFormatElement(prevChild, editor);
      if (prevInline) return prevInline;
    }
    if (offset < elContainer.childNodes.length) {
      const nextChild = elContainer.childNodes[offset];
      const nextInline = getClosestInlineFormatElement(nextChild, editor);
      if (nextInline) return nextInline;
    }
  }

  let el: HTMLElement | null =
    node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

  while (el && el !== editor && editor.contains(el)) {
    const tag = el.tagName.toLowerCase();
    if (tag === "code") {
      if (!el.closest("pre")) return el;
    } else if (
      tag === "strong" ||
      tag === "b" ||
      tag === "em" ||
      tag === "i" ||
      tag === "del" ||
      tag === "s" ||
      tag === "strike" ||
      tag === "a"
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Checks whether the current cursor selection is at the end boundary of an inline element.
 */
export function isCursorAtEndOfInline(el: HTMLElement, sel: Selection): boolean {
  if (!sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);

  if (range.startContainer === el.parentNode) {
    const childIndex = Array.prototype.indexOf.call(el.parentNode.childNodes, el);
    if (childIndex !== -1 && range.startOffset === childIndex + 1) {
      return true;
    }
  }

  if (!el.contains(range.startContainer)) return false;

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer as Text;
    const text = textNode.textContent || "";
    const afterOffset = text.slice(range.startOffset).replace(/[\u200B\uFEFF]/g, "");
    if (afterOffset.length > 0) return false;

    let curr: Node | null = textNode;
    while (curr && curr !== el) {
      let sibling = curr.nextSibling;
      while (sibling) {
        if (sibling.textContent?.replace(/[\u200B\uFEFF]/g, "").length) {
          return false;
        }
        sibling = sibling.nextSibling;
      }
      curr = curr.parentNode;
    }
    return true;
  }

  if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
    const container = range.startContainer as HTMLElement;
    if (range.startOffset >= container.childNodes.length) {
      let curr: Node | null = container;
      while (curr && curr !== el) {
        let sibling = curr.nextSibling;
        while (sibling) {
          if (sibling.textContent?.replace(/[\u200B\uFEFF]/g, "").length) {
            return false;
          }
          sibling = sibling.nextSibling;
        }
        curr = curr.parentNode;
      }
      return true;
    }
  }

  return false;
}

/**
 * Checks whether the current cursor selection is at the start boundary of an inline element.
 */
export function isCursorAtStartOfInline(el: HTMLElement, sel: Selection): boolean {
  if (!sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);

  if (range.startContainer === el.parentNode) {
    const childIndex = Array.prototype.indexOf.call(el.parentNode.childNodes, el);
    if (childIndex !== -1 && range.startOffset === childIndex) {
      return true;
    }
  }

  if (!el.contains(range.startContainer)) return false;

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer as Text;
    const text = textNode.textContent || "";
    const beforeOffset = text.slice(0, range.startOffset).replace(/[\u200B\uFEFF]/g, "");
    if (beforeOffset.length > 0) return false;

    let curr: Node | null = textNode;
    while (curr && curr !== el) {
      let sibling = curr.previousSibling;
      while (sibling) {
        if (sibling.textContent?.replace(/[\u200B\uFEFF]/g, "").length) {
          return false;
        }
        sibling = sibling.previousSibling;
      }
      curr = curr.parentNode;
    }
    return true;
  }

  if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
    if (range.startOffset === 0) {
      let curr: Node | null = range.startContainer;
      while (curr && curr !== el) {
        let sibling = curr.previousSibling;
        while (sibling) {
          if (sibling.textContent?.replace(/[\u200B\uFEFF]/g, "").length) {
            return false;
          }
          sibling = sibling.previousSibling;
        }
        curr = curr.parentNode;
      }
      return true;
    }
  }

  return false;
}

/**
 * Escapes cursor out of an inline format element forward (after element).
 */
export function stepOutOfInline(el: HTMLElement, sel: Selection, insertChar?: string) {
  const parent = el.parentNode;
  if (!parent) return;

  let targetNode: Text;
  let targetOffset: number;

  const next = el.nextSibling;
  if (next && next.nodeType === Node.TEXT_NODE) {
    targetNode = next as Text;
    if (insertChar) {
      targetNode.insertData(0, insertChar);
      targetOffset = insertChar.length;
    } else {
      if (!targetNode.textContent?.startsWith("\u200B")) {
        targetNode.insertData(0, "\u200B");
      }
      targetOffset = 1;
    }
  } else {
    const textContent = insertChar ? insertChar : "\u200B";
    targetNode = document.createTextNode(textContent);
    if (next) {
      parent.insertBefore(targetNode, next);
    } else {
      parent.appendChild(targetNode);
    }
    targetOffset = textContent.length;
  }

  const newRange = document.createRange();
  newRange.setStart(targetNode, targetOffset);
  newRange.setEnd(targetNode, targetOffset);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/**
 * Escapes cursor out of an inline format element backward (before element).
 */
export function stepOutBeforeInline(el: HTMLElement, sel: Selection) {
  const parent = el.parentNode;
  if (!parent) return;

  let targetNode: Text;
  let targetOffset: number;

  const prev = el.previousSibling;
  if (prev && prev.nodeType === Node.TEXT_NODE) {
    targetNode = prev as Text;
    if (!targetNode.textContent?.endsWith("\u200B")) {
      targetNode.appendData("\u200B");
    }
    targetOffset = targetNode.textContent.length - 1;
  } else {
    targetNode = document.createTextNode("\u200B");
    parent.insertBefore(targetNode, el);
    targetOffset = 0;
  }

  const newRange = document.createRange();
  newRange.setStart(targetNode, targetOffset);
  newRange.setEnd(targetNode, targetOffset);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/**
 * Ensures trailing zero-width space boundaries around inline formatting elements
 * to guarantee fluid cursor positioning and typing ergonomics.
 * Optimized: Only scans the current cursor block during editing; falls back to full editor only when specified.
 */
export function ensureTrailingBoundary(editor: HTMLElement, scopeToSelection: boolean = true) {
  let targetContainer: HTMLElement = editor;

  if (scopeToSelection) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const focusNode = sel.focusNode;
      if (focusNode && editor.contains(focusNode)) {
        let block: HTMLElement | null =
          focusNode.nodeType === Node.ELEMENT_NODE
            ? (focusNode as HTMLElement)
            : focusNode.parentElement;
        while (block && block !== editor && !/^(P|DIV|LI|H[1-6]|BLOCKQUOTE|PRE)$/i.test(block.tagName)) {
          block = block.parentElement;
        }
        if (block && block !== editor) {
          targetContainer = block;
        }
      }
    }
  }

  const inlineEls = targetContainer.querySelectorAll("code, strong, b, em, i, del, s, strike, a, img");
  inlineEls.forEach((el) => {
    if (el.tagName.toLowerCase() === "code" && el.closest("pre")) return;
    const parent = el.parentNode;
    if (!parent || parent === editor) return;

    // Ensure leading boundary for <img> so users can position cursor before it
    if (el.tagName.toLowerCase() === "img") {
      const prev = el.previousSibling;
      if (!prev) {
        parent.insertBefore(document.createTextNode("\u200B"), el);
      } else if (prev.nodeType === Node.TEXT_NODE && prev.textContent === "") {
        prev.textContent = "\u200B";
      }
    }

    const next = el.nextSibling;
    if (!next) {
      parent.appendChild(document.createTextNode("\u200B"));
    } else if (next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).tagName.toLowerCase() === "br") {
      parent.insertBefore(document.createTextNode("\u200B"), next);
    } else if (next.nodeType === Node.TEXT_NODE && next.textContent === "") {
      next.textContent = "\u200B";
    }
  });
}

/**
 * Restores selection into editor or creates a fallback range if lost.
 */
export function restoreSelection(
  editor: HTMLElement,
  savedSelection?: Range | null
): Range | null {
  let sel = window.getSelection();
  if (
    savedSelection &&
    sel &&
    (!sel.rangeCount || !editor.contains(sel.getRangeAt(0).commonAncestorContainer))
  ) {
    sel.removeAllRanges();
    sel.addRange(savedSelection);
  }

  sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const fallbackRange = document.createRange();
    fallbackRange.selectNodeContents(editor);
    fallbackRange.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(fallbackRange);
    return fallbackRange;
  }

  return sel.getRangeAt(0);
}

function safeIntersects(range: Range | null, n: Node): boolean {
  if (!range) return false;
  try {
    return range.intersectsNode(n);
  } catch {
    return false;
  }
}

/**
 * Applies or toggles inline formatting (bold, italic, strikethrough, code).
 */
export function applyInlineFormat(
  editor: HTMLElement,
  format: "bold" | "italic" | "strikethrough" | "code",
  savedSelection?: Range | null
) {
  const currentSel = window.getSelection();
  const range = restoreSelection(editor, savedSelection);
  if (!currentSel || !range) return;

  switch (format) {
    case "bold": {
      const node = range.commonAncestorContainer;
      const parentBold =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as HTMLElement).closest("b, strong, [style*='font-weight: bold'], [style*='font-weight:bold']")
          : node.parentElement?.closest("b, strong, [style*='font-weight: bold'], [style*='font-weight:bold']");

      if (parentBold) {
        if (currentSel.isCollapsed && isCursorAtEndOfInline(parentBold as HTMLElement, currentSel)) {
          stepOutOfInline(parentBold as HTMLElement, currentSel);
          break;
        }
        if (currentSel.isCollapsed && isCursorAtStartOfInline(parentBold as HTMLElement, currentSel)) {
          stepOutBeforeInline(parentBold as HTMLElement, currentSel);
          break;
        }

        const parent = parentBold.parentNode;
        if (parent) {
          const childNodes = Array.from(parentBold.childNodes);
          while (parentBold.firstChild) {
            parent.insertBefore(parentBold.firstChild, parentBold);
          }
          parent.removeChild(parentBold);
          if (!currentSel.isCollapsed && childNodes.length > 0) {
            const newRange = document.createRange();
            newRange.setStartBefore(childNodes[0]);
            newRange.setEndAfter(childNodes[childNodes.length - 1]);
            currentSel.removeAllRanges();
            currentSel.addRange(newRange);
          }
        }
        break;
      }

      const boldEls = Array.from(
        editor.querySelectorAll("b, strong, [style*='font-weight: bold'], [style*='font-weight:bold']")
      ).filter((el) => safeIntersects(range, el));
      if (boldEls.length > 0) {
        boldEls.forEach((el) => {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        });
        break;
      }

      const selectedText = currentSel.toString();
      if (selectedText) {
        const strongEl = document.createElement("strong");
        strongEl.appendChild(range.extractContents());
        range.insertNode(strongEl);

        const newRange = document.createRange();
        newRange.selectNodeContents(strongEl);
        currentSel.removeAllRanges();
        currentSel.addRange(newRange);
      } else {
        document.execCommand("bold");
      }
      break;
    }

    case "italic": {
      const node = range.commonAncestorContainer;
      const parentItalic =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as HTMLElement).closest("i, em, [style*='font-style: italic'], [style*='font-style:italic']")
          : node.parentElement?.closest("i, em, [style*='font-style: italic'], [style*='font-style:italic']");

      if (parentItalic) {
        if (currentSel.isCollapsed && isCursorAtEndOfInline(parentItalic as HTMLElement, currentSel)) {
          stepOutOfInline(parentItalic as HTMLElement, currentSel);
          break;
        }
        if (currentSel.isCollapsed && isCursorAtStartOfInline(parentItalic as HTMLElement, currentSel)) {
          stepOutBeforeInline(parentItalic as HTMLElement, currentSel);
          break;
        }

        const parent = parentItalic.parentNode;
        if (parent) {
          const childNodes = Array.from(parentItalic.childNodes);
          while (parentItalic.firstChild) {
            parent.insertBefore(parentItalic.firstChild, parentItalic);
          }
          parent.removeChild(parentItalic);
          if (!currentSel.isCollapsed && childNodes.length > 0) {
            const newRange = document.createRange();
            newRange.setStartBefore(childNodes[0]);
            newRange.setEndAfter(childNodes[childNodes.length - 1]);
            currentSel.removeAllRanges();
            currentSel.addRange(newRange);
          }
        }
        break;
      }

      const italicEls = Array.from(
        editor.querySelectorAll("i, em, [style*='font-style: italic'], [style*='font-style:italic']")
      ).filter((el) => safeIntersects(range, el));
      if (italicEls.length > 0) {
        italicEls.forEach((el) => {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        });
        break;
      }

      const selectedText = currentSel.toString();
      if (selectedText) {
        const emEl = document.createElement("em");
        emEl.appendChild(range.extractContents());
        range.insertNode(emEl);

        const newRange = document.createRange();
        newRange.selectNodeContents(emEl);
        currentSel.removeAllRanges();
        currentSel.addRange(newRange);
      } else {
        document.execCommand("italic");
      }
      break;
    }

    case "strikethrough": {
      const node = range.commonAncestorContainer;
      const parentStrike =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as HTMLElement).closest("s, del, strike, [style*='line-through']")
          : node.parentElement?.closest("s, del, strike, [style*='line-through']");

      if (parentStrike) {
        if (currentSel.isCollapsed && isCursorAtEndOfInline(parentStrike as HTMLElement, currentSel)) {
          stepOutOfInline(parentStrike as HTMLElement, currentSel);
          break;
        }
        if (currentSel.isCollapsed && isCursorAtStartOfInline(parentStrike as HTMLElement, currentSel)) {
          stepOutBeforeInline(parentStrike as HTMLElement, currentSel);
          break;
        }

        const parent = parentStrike.parentNode;
        if (parent) {
          const childNodes = Array.from(parentStrike.childNodes);
          while (parentStrike.firstChild) {
            parent.insertBefore(parentStrike.firstChild, parentStrike);
          }
          parent.removeChild(parentStrike);
          if (!currentSel.isCollapsed && childNodes.length > 0) {
            const newRange = document.createRange();
            newRange.setStartBefore(childNodes[0]);
            newRange.setEndAfter(childNodes[childNodes.length - 1]);
            currentSel.removeAllRanges();
            currentSel.addRange(newRange);
          }
        }
        break;
      }

      const strikeEls = Array.from(
        editor.querySelectorAll("s, del, strike, [style*='line-through']")
      ).filter((el) => safeIntersects(range, el));
      if (strikeEls.length > 0) {
        strikeEls.forEach((el) => {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        });
        break;
      }

      const selectedText = currentSel.toString();
      if (selectedText) {
        const delEl = document.createElement("del");
        delEl.appendChild(range.extractContents());
        range.insertNode(delEl);

        const newRange = document.createRange();
        newRange.selectNodeContents(delEl);
        currentSel.removeAllRanges();
        currentSel.addRange(newRange);
      } else {
        document.execCommand("strikeThrough");
      }
      break;
    }

    case "code": {
      const anchorNode = range.commonAncestorContainer;
      const parentCode =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as HTMLElement).closest("code")
          : anchorNode.parentElement?.closest("code");

      if (parentCode && parentCode.parentElement?.tagName.toLowerCase() !== "pre") {
        if (currentSel.isCollapsed && isCursorAtEndOfInline(parentCode, currentSel)) {
          stepOutOfInline(parentCode, currentSel);
          break;
        }
        if (currentSel.isCollapsed && isCursorAtStartOfInline(parentCode, currentSel)) {
          stepOutBeforeInline(parentCode, currentSel);
          break;
        }

        const parent = parentCode.parentNode;
        if (parent) {
          const childNodes = Array.from(parentCode.childNodes);
          while (parentCode.firstChild) {
            parent.insertBefore(parentCode.firstChild, parentCode);
          }
          parent.removeChild(parentCode);
          if (!currentSel.isCollapsed && childNodes.length > 0) {
            const newRange = document.createRange();
            newRange.setStartBefore(childNodes[0]);
            newRange.setEndAfter(childNodes[childNodes.length - 1]);
            currentSel.removeAllRanges();
            currentSel.addRange(newRange);
          }
        }
        break;
      }

      const codeEls = Array.from(editor.querySelectorAll("code")).filter(
        (c) => c.parentElement?.tagName.toLowerCase() !== "pre" && safeIntersects(range, c)
      );
      if (codeEls.length > 0) {
        codeEls.forEach((c) => {
          const parent = c.parentNode;
          if (parent) {
            while (c.firstChild) {
              parent.insertBefore(c.firstChild, c);
            }
            parent.removeChild(c);
          }
        });
        break;
      }

      const selectedText = currentSel.toString();
      if (selectedText) {
        const codeEl = document.createElement("code");
        codeEl.textContent = selectedText;
        range.deleteContents();
        range.insertNode(codeEl);

        const newRange = document.createRange();
        newRange.selectNodeContents(codeEl);
        currentSel.removeAllRanges();
        currentSel.addRange(newRange);
      } else {
        const codeEl = document.createElement("code");
        const zws = document.createTextNode("\u200B");
        codeEl.appendChild(zws);
        range.deleteContents();
        range.insertNode(codeEl);

        const newRange = document.createRange();
        newRange.setStart(zws, 1);
        newRange.setEnd(zws, 1);
        currentSel.removeAllRanges();
        currentSel.addRange(newRange);
      }
      break;
    }
  }
}

/**
 * Applies or toggles block formatting (paragraphs, headings, blockquotes, code-blocks).
 */
export function applyBlockFormat(
  _editor: HTMLElement,
  format: "paragraph" | HeadingType | "quote" | "code-block",
  savedSelection?: Range | null
) {
  const currentSel = window.getSelection();
  const range = restoreSelection(_editor, savedSelection);
  if (!currentSel || !range) return;

  switch (format) {
    case "paragraph":
      document.execCommand("formatBlock", false, "p");
      break;

    case "heading-1":
    case "heading-2":
    case "heading-3":
    case "heading-4":
    case "heading-5":
    case "heading-6": {
      const targetTag = format.replace("heading-", "h");
      const node = range.commonAncestorContainer;
      const headingEl =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as HTMLElement).closest("h1, h2, h3, h4, h5, h6")
          : node.parentElement?.closest("h1, h2, h3, h4, h5, h6") ?? null;

      if (headingEl && headingEl.tagName.toLowerCase() === targetTag) {
        document.execCommand("formatBlock", false, "p");
      } else {
        document.execCommand("formatBlock", false, targetTag);
      }
      break;
    }

    case "quote": {
      const anchorNode = range.commonAncestorContainer;
      const blockquoteEl =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as HTMLElement).closest("blockquote")
          : anchorNode.parentElement?.closest("blockquote");

      if (blockquoteEl) {
        const parent = blockquoteEl.parentNode;
        if (parent) {
          while (blockquoteEl.firstChild) {
            parent.insertBefore(blockquoteEl.firstChild, blockquoteEl);
          }
          parent.removeChild(blockquoteEl);
        }
        break;
      }
      document.execCommand("formatBlock", false, "blockquote");
      break;
    }

    case "code-block": {
      const anchorNode = range.commonAncestorContainer;
      const preEl =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as HTMLElement).closest("pre")
          : anchorNode.parentElement?.closest("pre");

      if (preEl) {
        const text = preEl.textContent || "";
        const lines = text.split("\n");
        const frag = document.createDocumentFragment();
        lines.forEach((line) => {
          const p = document.createElement("p");
          p.textContent = line || "";
          if (!line) {
            p.appendChild(document.createElement("br"));
          }
          frag.appendChild(p);
        });
        preEl.replaceWith(frag);
        break;
      }

      const selectedText = currentSel.toString();
      const pre = document.createElement("pre");
      const code = document.createElement("code");

      if (selectedText) {
        code.textContent = selectedText;
        pre.appendChild(code);
        range.deleteContents();
        range.insertNode(pre);

        const pEl = document.createElement("p");
        pEl.innerHTML = "<br>";
        pre.after(pEl);

        range.setStartAfter(pre);
        range.setEndAfter(pre);
        currentSel.removeAllRanges();
        currentSel.addRange(range);
      } else {
        const brEl = document.createElement("br");
        code.appendChild(brEl);
        pre.appendChild(code);
        range.deleteContents();
        range.insertNode(pre);

        const pEl = document.createElement("p");
        pEl.innerHTML = "<br>";
        pre.after(pEl);

        const newRange = document.createRange();
        newRange.setStart(code, 0);
        newRange.setEnd(code, 0);
        currentSel.removeAllRanges();
        currentSel.addRange(newRange);
      }
      break;
    }
  }
}

/**
 * Inserts an image block with proper ZWS navigation boundaries and local asset handling.
 */
export function insertImage(
  editor: HTMLElement,
  src: string,
  alt: string = "",
  title?: string,
  options?: {
    notebookPath?: string;
    savedSelection?: Range | null;
  }
): Range | null {
  editor.focus();
  const range = restoreSelection(editor, options?.savedSelection);

  const p = document.createElement("p");
  p.className = "image-block";

  const preZws = document.createTextNode("\u200B");
  const img = document.createElement("img");
  img.setAttribute("src", src);
  img.src = src;

  const isTauriEnv = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
  const notebookPath = options?.notebookPath;
  if ((src.startsWith("./assets/") || src.startsWith("assets/")) && isTauriEnv && notebookPath) {
    img.setAttribute("data-markdown-src", src);
    try {
      const cleanRel = src.replace(/^\.\//, "");
      const absPath = `${notebookPath.replace(/[\\/]+$/, "")}/${cleanRel}`;
      img.src = convertFileSrc(absPath);
    } catch {}
  }
  if (alt) img.alt = alt;
  if (title) img.title = title;
  img.loading = "lazy";
  const postZws = document.createTextNode("\u200B");

  p.appendChild(preZws);
  p.appendChild(img);
  p.appendChild(postZws);

  if (!range) {
    editor.appendChild(p);
  } else {
    let block: HTMLElement | null = null;
    let node: Node | null = range.commonAncestorContainer;
    while (node && node !== editor) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI)$/i.test((node as HTMLElement).tagName)
      ) {
        block = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }

    if (block && block !== editor) {
      const isBlockEmpty = !block.textContent?.replace(/[\u200B\uFEFF]/g, "").trim();
      if (isBlockEmpty) {
        block.replaceWith(p);
      } else {
        block.after(p);
      }
    } else {
      range.deleteContents();
      range.insertNode(p);
    }
  }

  // Ensure trailing paragraph so users can continue typing/navigating after image block
  const nextEl = p.nextElementSibling;
  if (!nextEl) {
    const trailingP = document.createElement("p");
    trailingP.innerHTML = "<br>";
    p.after(trailingP);
  }

  // Position cursor at post-image boundary
  const sel = window.getSelection();
  let newRange: Range | null = null;
  if (sel) {
    newRange = document.createRange();
    newRange.setStart(postZws, 1);
    newRange.setEnd(postZws, 1);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  ensureTrailingBoundary(editor);
  return newRange;
}

/**
 * Inserts a table with the specified rows and columns.
 */
export function insertTable(
  editor: HTMLElement,
  rows: number = 3,
  cols: number = 3,
  savedSelection?: Range | null
): Range | null {
  const rowCount = typeof rows === "number" && rows > 0 ? rows : 3;
  const colCount = typeof cols === "number" && cols > 0 ? cols : 3;

  editor.focus();
  const range = restoreSelection(editor, savedSelection);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerTr = document.createElement("tr");

  for (let c = 0; c < colCount; c++) {
    const th = document.createElement("th");
    th.innerHTML = `标题 ${c + 1}`;
    headerTr.appendChild(th);
  }
  thead.appendChild(headerTr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const bodyRowCount = Math.max(0, rowCount - 1);
  for (let r = 0; r < bodyRowCount; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < colCount; c++) {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  if (!range) {
    editor.appendChild(table);
  } else {
    let block: HTMLElement | null = null;
    let node: Node | null = range.commonAncestorContainer;
    while (node && node !== editor) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|TABLE)$/i.test((node as HTMLElement).tagName)
      ) {
        block = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }

    if (block && block !== editor) {
      const isBlockEmpty = !block.textContent?.replace(/[\u200B\uFEFF]/g, "").trim();
      if (isBlockEmpty && block.tagName.toLowerCase() === "p") {
        block.replaceWith(table);
      } else {
        block.after(table);
      }
    } else {
      range.deleteContents();
      range.insertNode(table);
    }
  }

  // Ensure trailing paragraph so users can continue typing/navigating after table
  const nextEl = table.nextElementSibling;
  if (!nextEl) {
    const trailingP = document.createElement("p");
    trailingP.innerHTML = "<br>";
    table.after(trailingP);
  }

  // Places cursor in the first header cell
  let newRange: Range | null = null;
  const firstTh = headerTr.firstElementChild as HTMLElement | null;
  if (firstTh) {
    newRange = document.createRange();
    newRange.selectNodeContents(firstTh);
    const curSel = window.getSelection();
    if (curSel) {
      curSel.removeAllRanges();
      curSel.addRange(newRange);
    }
    firstTh.focus();
  }

  ensureTrailingBoundary(editor);
  return newRange;
}

/**
 * Inserts or toggles a task list checkbox on current selection or block.
 */
export function insertTaskList(editor: HTMLElement, savedSelection?: Range | null) {
  const currentSel = window.getSelection();
  const range = restoreSelection(editor, savedSelection);
  if (!currentSel || !range) return;

  const anchorNode = range.commonAncestorContainer;
  const liEl =
    anchorNode.nodeType === Node.ELEMENT_NODE
      ? (anchorNode as HTMLElement).closest("li")
      : anchorNode.parentElement?.closest("li");

  if (liEl && (liEl.classList.contains("task-list-item") || liEl.querySelector('input[type="checkbox"]'))) {
    const cb = liEl.querySelector('input[type="checkbox"]');
    if (cb) cb.remove();
    liEl.classList.remove("task-list-item");
    const parentUl = liEl.closest("ul");
    if (parentUl && !parentUl.querySelector('input[type="checkbox"]')) {
      parentUl.classList.remove("task-list");
    }
    return;
  }

  if (liEl) {
    liEl.classList.add("task-list-item");
    const parentUl = liEl.closest("ul");
    if (parentUl) {
      parentUl.classList.add("task-list");
    }
    const cb = document.createElement("input");
    cb.type = "checkbox";
    liEl.prepend(cb);
    liEl.normalize();
    return;
  }

  const selectedText = currentSel.toString().trim();
  const taskUl = document.createElement("ul");
  taskUl.className = "task-list";
  const taskLi = document.createElement("li");
  taskLi.className = "task-list-item";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";

  taskLi.appendChild(checkbox);
  const textNode = document.createTextNode(selectedText ? ` ${selectedText}` : " 任务待办");
  taskLi.appendChild(textNode);
  taskUl.appendChild(taskLi);

  let block: HTMLElement | null = null;
  let node: Node | null = range.commonAncestorContainer;
  while (node && node !== editor) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|UL|OL|TABLE)$/i.test((node as HTMLElement).tagName)
    ) {
      block = node as HTMLElement;
      break;
    }
    node = node.parentNode;
  }

  if (block && block !== editor) {
    const isBlockEmpty = !block.textContent?.replace(/[\u200B\uFEFF]/g, "").trim();
    if (isBlockEmpty && (block.tagName.toLowerCase() === "p" || block.tagName.toLowerCase() === "div")) {
      block.replaceWith(taskUl);
    } else {
      block.after(taskUl);
    }
  } else {
    range.deleteContents();
    range.insertNode(taskUl);
  }

  const newRange = document.createRange();
  newRange.setStart(textNode, 1);
  newRange.setEnd(textNode, textNode.textContent?.length || 1);
  currentSel.removeAllRanges();
  currentSel.addRange(newRange);
}

/**
 * Inserts a horizontal rule.
 */
export function insertHorizontalRule() {
  document.execCommand("insertHorizontalRule");
}

/**
 * Inserts or removes a hyperlink at current selection.
 */
export function insertLink(
  editor: HTMLElement,
  url: string,
  text?: string,
  savedRange?: Range | null
) {
  editor.focus();
  const selection = window.getSelection();
  if (savedRange && selection) {
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  const currentSel = window.getSelection();
  if (currentSel && currentSel.rangeCount > 0) {
    const range = currentSel.getRangeAt(0);
    const textToDisplay = text?.trim() || url;
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.target = "_blank";
    aEl.rel = "noopener noreferrer";
    aEl.textContent = textToDisplay;

    range.deleteContents();
    range.insertNode(aEl);
    range.setStartAfter(aEl);
    range.setEndAfter(aEl);
    currentSel.removeAllRanges();
    currentSel.addRange(range);
  }

  ensureTrailingBoundary(editor);
}

/**
 * Central action dispatcher for formatting commands.
 */
export function executeFormatAction(
  editor: HTMLElement,
  action: FormatAction,
  context?: {
    savedSelection?: Range | null;
    notebookPath?: string;
    onOpenLinkDialog?: (text: string, range: Range | null) => void;
    onOpenImageDialog?: () => void;
    onOpenTableDialog?: () => void;
  }
) {
  editor.focus();
  const range = restoreSelection(editor, context?.savedSelection);

  switch (action) {
    case "undo":
      document.execCommand("undo");
      break;
    case "redo":
      document.execCommand("redo");
      break;
    case "paragraph":
      applyBlockFormat(editor, "paragraph", range);
      break;
    case "heading-1":
    case "heading-2":
    case "heading-3":
    case "heading-4":
    case "heading-5":
    case "heading-6":
      applyBlockFormat(editor, action, range);
      break;
    case "bold":
      applyInlineFormat(editor, "bold", range);
      break;
    case "italic":
      applyInlineFormat(editor, "italic", range);
      break;
    case "strikethrough":
      applyInlineFormat(editor, "strikethrough", range);
      break;
    case "code":
      applyInlineFormat(editor, "code", range);
      break;
    case "code-block":
      applyBlockFormat(editor, "code-block", range);
      break;
    case "quote":
      applyBlockFormat(editor, "quote", range);
      break;
    case "bullet-list":
      document.execCommand("insertUnorderedList");
      break;
    case "numbered-list":
      document.execCommand("insertOrderedList");
      break;
    case "task-list":
      insertTaskList(editor, range);
      break;
    case "hr":
      insertHorizontalRule();
      break;
    case "table":
      if (context?.onOpenTableDialog) {
        context.onOpenTableDialog();
      } else {
        insertTable(editor, 3, 3, range);
      }
      break;
    case "link": {
      const currentSel = window.getSelection();
      if (currentSel && range && editor.contains(range.commonAncestorContainer)) {
        const anchorNode = range.commonAncestorContainer;
        const linkEl =
          anchorNode.nodeType === Node.ELEMENT_NODE
            ? (anchorNode as HTMLElement).closest("a")
            : anchorNode.parentElement?.closest("a");

        if (linkEl) {
          document.execCommand("unlink");
          break;
        }

        context?.onOpenLinkDialog?.(currentSel.toString(), range.cloneRange());
      } else if (context?.savedSelection) {
        context?.onOpenLinkDialog?.(context.savedSelection.toString(), context.savedSelection.cloneRange());
      } else {
        context?.onOpenLinkDialog?.("", null);
      }
      return;
    }
    case "image":
      context?.onOpenImageDialog?.();
      break;
  }

  ensureTrailingBoundary(editor);
}
