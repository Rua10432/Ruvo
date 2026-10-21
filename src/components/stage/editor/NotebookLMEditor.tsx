import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { snackbar } from "mdui";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { FileNote, LocalNote } from "../../../types";
import {
  defaultActiveFormats,
  type FormatAction,
} from "../StageToolbar";
import { domToMarkdown } from "../../../utils/domToMarkdown";
import { useRuvoSettings } from "../../settings/settingsStore";
import { highlightSpellingErrors, clearSpellingHighlights } from "../../../utils/spellcheck";
import { fileStore } from "../../../services/fileStore";
import {
  wikilinkExtension,
  filterWikiLinkSuggestions,
  type WikiLinkSuggestion,
} from "../../../utils/wikiLinkPlugin";
import { stripMarkdownToPlainText } from "../../../utils/markdownAnalysis";
import ImageInsertDialog from "../ImageInsertDialog";
import LinkInsertDialog from "./LinkInsertDialog";
import TableInsertDialog from "./TableInsertDialog";
import WikiLinkAutocomplete from "./WikiLinkAutocomplete";
import WikiLinkHoverCard from "./WikiLinkHoverCard";
import { useScrollSpy } from "./useScrollSpy";
import { getActiveFormats, type FormatState } from "./editorFormatSniffer";
import {
  ensureTrailingBoundary,
  executeFormatAction,
  insertImage as insertImageDOM,
  insertLink as insertLinkDOM,
  insertTable as insertTableDOM,
} from "./editorFormatters";
import { handleEditorKeyDown } from "./editorKeyboard";
import "./WikiLink.css";

export type NotebookLMEditorHandle = {
  format: (action: FormatAction) => void;
  focus: () => void;
  insertImage: (src: string, alt?: string, title?: string) => void;
  insertTable: (rows?: number, cols?: number) => void;
  flush: () => void;
};

export type { FormatState };

export type NotebookLMEditorProps = {
  activeNote: LocalNote;
  onChange: (markdownContent: string) => void;
  onSave?: () => void;
  requestedHeading?: string | null;
  onActiveHeadingChange?: (text: string, index: number) => void;
  onFormatStateChange?: (state: FormatState) => void;
  fileNotes?: FileNote[];
  onSelectNote?: (note: FileNote) => void;
  onCreateNote?: (requestedName?: string) => void;
};

const DOMPURIFY_CONFIG = {
  ADD_TAGS: ["img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "input", "span", "a"],
  ADD_ATTR: ["loading", "type", "checked", "disabled", "data-target", "data-raw", "class", "contenteditable", "role", "tabindex", "title"],
  ADD_DATA_URI_TAGS: ["img"],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

marked.use({
  gfm: true,
  breaks: true,
  extensions: [wikilinkExtension],
});

const NotebookLMEditor = forwardRef<NotebookLMEditorHandle, NotebookLMEditorProps>(
  (
    {
      activeNote,
      onChange,
      onSave,
      requestedHeading,
      onActiveHeadingChange,
      onFormatStateChange,
      fileNotes,
      onSelectNote,
      onCreateNote,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastNoteIdRef = useRef<string | null>(null);
    const lastRenderedContentRef = useRef<string>("");
    const { settings } = useRuvoSettings();

    const spellcheckTimerRef = useRef<number | null>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const savedSelectionRef = useRef<Range | null>(null);
    const prevFormatStateRef = useRef<FormatState | null>(null);
    const debounceTimerRef = useRef<number | null>(null);
    const hasPendingChangesRef = useRef(false);

    // Dialog states
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkText, setLinkText] = useState("");
    const [linkUrl, setLinkUrl] = useState("https://");
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [tableDialogOpen, setTableDialogOpen] = useState(false);

    // WikiLink Autocomplete state
    const isComposingRef = useRef(false);
    const [autocompleteState, setAutocompleteState] = useState<{
      open: boolean;
      query: string;
      position: { top: number; left: number };
      textNode: Node | null;
      triggerOffset: number;
      caretOffset: number;
    }>({
      open: false,
      query: "",
      position: { top: 0, left: 0 },
      textNode: null,
      triggerOffset: -1,
      caretOffset: -1,
    });
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

    const suggestions = useMemo(() => {
      if (!autocompleteState.open) return [];
      return filterWikiLinkSuggestions(fileNotes || [], autocompleteState.query, activeNote.id);
    }, [autocompleteState.open, autocompleteState.query, fileNotes, activeNote.id]);

    useEffect(() => {
      setSelectedSuggestionIndex(0);
    }, [autocompleteState.query]);

    // WikiLink Hover Preview state
    const hoverTimerRef = useRef<number | null>(null);
    const closeHoverTimerRef = useRef<number | null>(null);
    const [hoverCard, setHoverCard] = useState<{
      open: boolean;
      targetName: string;
      matchedNote: FileNote | null;
      excerpt: string;
      position: { top: number; left: number };
    }>({
      open: false,
      targetName: "",
      matchedNote: null,
      excerpt: "",
      position: { top: 0, left: 0 },
    });

    const notebookPath = activeNote.notebookId || (activeNote.path ? activeNote.path.replace(/[\\/][^\\/]+$/, "") : "");

    // Scroll spy integration
    useScrollSpy({
      editorRef,
      requestedHeading,
      onActiveHeadingChange,
      activeNoteId: activeNote.id,
    });

    const triggerSpellCheck = useCallback(() => {
      if (!settings.spellcheck || !editorRef.current) return;
      if (spellcheckTimerRef.current) {
        window.clearTimeout(spellcheckTimerRef.current);
      }
      spellcheckTimerRef.current = window.setTimeout(() => {
        if (editorRef.current && settings.spellcheck) {
          highlightSpellingErrors(editorRef.current);
        }
      }, 180);
    }, [settings.spellcheck]);

    // Spellcheck synchronization
    useEffect(() => {
      const editor = editorRef.current;
      if (editor) {
        editor.setAttribute("spellcheck", settings.spellcheck ? "true" : "false");
        editor.setAttribute("lang", settings.spellcheck ? "en-US" : "zh-CN");
        editor.spellcheck = settings.spellcheck;
        editor.lang = settings.spellcheck ? "en-US" : "zh-CN";

        if (settings.spellcheck) {
          highlightSpellingErrors(editor);
        } else {
          clearSpellingHighlights();
        }
      }
      return () => {
        if (spellcheckTimerRef.current) {
          window.clearTimeout(spellcheckTimerRef.current);
        }
      };
    }, [settings.spellcheck]);

    const flushPending = useCallback(() => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (hasPendingChangesRef.current && editorRef.current) {
        hasPendingChangesRef.current = false;
        const md = domToMarkdown(editorRef.current);
        lastRenderedContentRef.current = md;
        onChange(md);
      }
    }, [onChange]);

    // Flush on unmount
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        if (hasPendingChangesRef.current && editorRef.current) {
          hasPendingChangesRef.current = false;
          const md = domToMarkdown(editorRef.current);
          lastRenderedContentRef.current = md;
          onChange(md);
        }
      };
    }, [onChange]);

    const emitFormatState = useCallback(() => {
      const editor = editorRef.current;
      const formatState = getActiveFormats(editor);
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      }
      // Shallow comparison guard to prevent redundant re-renders (3 events per keystroke)
      const prev = prevFormatStateRef.current;
      if (prev && prev.hasSelection === formatState.hasSelection) {
        const pf = prev.activeFormats;
        const nf = formatState.activeFormats;
        if (
          pf.bold === nf.bold &&
          pf.italic === nf.italic &&
          pf.strikethrough === nf.strikethrough &&
          pf.code === nf.code &&
          pf.codeBlock === nf.codeBlock &&
          pf.quote === nf.quote &&
          pf.link === nf.link &&
          pf.heading === nf.heading &&
          pf.bulletList === nf.bulletList &&
          pf.numberedList === nf.numberedList &&
          pf.taskList === nf.taskList
        ) {
          return;
        }
      }
      prevFormatStateRef.current = formatState;
      onFormatStateChange?.(formatState);
    }, [onFormatStateChange]);

    // Selection change tracking
    useEffect(() => {
      const handleSelectionChange = () => {
        emitFormatState();
      };
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => {
        document.removeEventListener("selectionchange", handleSelectionChange);
      };
    }, [emitFormatState]);

    // Load active note content
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const noteChanged = lastNoteIdRef.current !== activeNote.id;
      const contentExternallyChanged = activeNote.content !== lastRenderedContentRef.current;

      if (noteChanged || contentExternallyChanged) {
        if (noteChanged) {
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          hasPendingChangesRef.current = false;
          prevFormatStateRef.current = null;
          onFormatStateChange?.({
            hasSelection: false,
            activeFormats: { ...defaultActiveFormats },
          });
        }
        lastNoteIdRef.current = activeNote.id;
        lastRenderedContentRef.current = activeNote.content || "";
        let raw = activeNote.content || "";
        if (raw.includes("data:image/svg+xml")) {
          raw = raw.replace(
            /!\[Ruvo 演示徽标\]\(data:image\/svg\+xml;utf8,[^\)]+\)/g,
            '![Ruvo 演示徽标](./assets/ruvo_logo.png "Ruvo 官方徽标")'
          );
        }
        const rawHtml = raw.trim() ? (marked.parse(raw, { async: false }) as string) : "<p><br></p>";
        editor.innerHTML = DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG) as string;

        const isTauriEnv = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
        editor.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
          const rawSrc = img.getAttribute("src") || "";
          if (rawSrc.startsWith("./assets/") || rawSrc.startsWith("assets/")) {
            img.setAttribute("data-markdown-src", rawSrc);
            if (isTauriEnv && notebookPath) {
              try {
                const cleanRel = rawSrc.replace(/^\.\//, "");
                const absPath = `${notebookPath.replace(/[\\/]+$/, "")}/${cleanRel}`;
                img.src = convertFileSrc(absPath);
              } catch {}
            } else if (!isTauriEnv) {
              img.src = rawSrc.startsWith(".") ? rawSrc.slice(1) : `/${rawSrc}`;
            }
            img.onerror = () => {
              if (rawSrc.includes("ruvo_logo") || rawSrc.includes("logo")) {
                img.src = "/assets/ruvo_logo.png";
              }
            };
          }
        });

        editor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
          cb.removeAttribute("disabled");
          cb.setAttribute("contenteditable", "false");
          const parentLi = cb.closest("li");
          if (parentLi) {
            parentLi.classList.add("task-list-item");
            if (cb.checked) {
              parentLi.classList.add("is-completed");
            } else {
              parentLi.classList.remove("is-completed");
            }
            const parentUl = parentLi.closest("ul");
            if (parentUl) {
              parentUl.classList.add("task-list");
            }
          }
        });

        ensureTrailingBoundary(editor, false);
        if (settings.spellcheck) {
          highlightSpellingErrors(editor);
        }
      }
    }, [activeNote.id, activeNote.content, notebookPath, onFormatStateChange, settings.spellcheck]);

    const checkWikiLinkTrigger = useCallback(() => {
      if (isComposingRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
        setAutocompleteState((prev) => (prev.open ? { ...prev, open: false } : prev));
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE || !editorRef.current?.contains(node)) {
        setAutocompleteState((prev) => (prev.open ? { ...prev, open: false } : prev));
        return;
      }

      const text = node.textContent || "";
      const offset = range.startOffset;
      const before = text.slice(0, offset);

      const lastTrigger = before.lastIndexOf("[[");
      if (lastTrigger === -1) {
        setAutocompleteState((prev) => (prev.open ? { ...prev, open: false } : prev));
        return;
      }

      const query = before.slice(lastTrigger + 2);
      if (query.includes("]]") || query.includes("\n") || query.length > 50) {
        setAutocompleteState((prev) => (prev.open ? { ...prev, open: false } : prev));
        return;
      }

      let clientRect: DOMRect | null = null;
      try {
        const clone = range.cloneRange();
        const rects = clone.getClientRects();
        if (rects.length > 0) {
          clientRect = rects[0];
        } else {
          clientRect = clone.getBoundingClientRect();
        }
      } catch {}

      if (!clientRect || (clientRect.top === 0 && clientRect.bottom === 0)) {
        const parent = node.parentElement;
        if (parent) {
          clientRect = parent.getBoundingClientRect();
        }
      }

      const top = clientRect ? clientRect.bottom + 6 : 100;
      const left = clientRect ? Math.max(16, Math.min(clientRect.left, window.innerWidth - 320)) : 100;

      setAutocompleteState({
        open: true,
        query,
        position: { top, left },
        textNode: node,
        triggerOffset: lastTrigger,
        caretOffset: offset,
      });
    }, []);

    const handleInput = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      ensureTrailingBoundary(editor);
      emitFormatState();
      triggerSpellCheck();
      if (!isComposingRef.current) {
        checkWikiLinkTrigger();
      }

      hasPendingChangesRef.current = true;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        if (hasPendingChangesRef.current && editorRef.current) {
          hasPendingChangesRef.current = false;
          const md = domToMarkdown(editorRef.current);
          lastRenderedContentRef.current = md;
          onChange(md);
        }
      }, 250);
    }, [emitFormatState, triggerSpellCheck, checkWikiLinkTrigger, onChange]);

    const confirmAutocomplete = useCallback(
      (selected: WikiLinkSuggestion) => {
        const { textNode, triggerOffset, caretOffset } = autocompleteState;
        if (!textNode || !textNode.parentNode) return;

        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(textNode, triggerOffset);
        range.setEnd(textNode, caretOffset);
        range.deleteContents();

        const noteName = selected.title.replace(/\.md$/i, "");
        const replacement = `[[${noteName}]] `;
        const newTextNode = document.createTextNode(replacement);
        range.insertNode(newTextNode);

        const newRange = document.createRange();
        newRange.setStart(newTextNode, replacement.length);
        newRange.setEnd(newTextNode, replacement.length);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(newRange);
        }

        setAutocompleteState((prev) => ({ ...prev, open: false }));

        if (selected.isCreateNew && onCreateNote) {
          onCreateNote(noteName);
        }

        handleInput();
        emitFormatState();
      },
      [autocompleteState, handleInput, emitFormatState, onCreateNote]
    );

    const handleNavigateWikiLink = useCallback(
      (target: string | FileNote) => {
        if (typeof target === "object" && target !== null) {
          onSelectNote?.(target);
          snackbar({ message: `已跳转至“${target.name.replace(/\.md$/i, "")}”` });
          setHoverCard((prev) => ({ ...prev, open: false }));
          return;
        }
        const cleanTarget = target.replace(/^\[\[|\]\]$/g, "").trim().toLowerCase();
        const matched = fileNotes?.find(
          (n) =>
            n.name.replace(/\.md$/i, "").toLowerCase() === cleanTarget ||
            n.id.toLowerCase() === cleanTarget
        );
        if (matched) {
          onSelectNote?.(matched);
          snackbar({ message: `已跳转至“${matched.name.replace(/\.md$/i, "")}”` });
        } else if (onCreateNote) {
          onCreateNote(target.replace(/^\[\[|\]\]$/g, "").trim());
        } else {
          snackbar({ message: `未找到笔记：“${target}”` });
        }
        setHoverCard((prev) => ({ ...prev, open: false }));
      },
      [fileNotes, onSelectNote, onCreateNote]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const wikilink = target.closest(".ruvo-wikilink, .ruam-wikilink") as HTMLElement | null;

        if (wikilink) {
          const targetName =
            wikilink.getAttribute("data-target") ||
            wikilink.textContent?.replace(/^\[\[|\]\]$/g, "").trim() ||
            "";
          if (!targetName) return;

          if (hoverCard.open && hoverCard.targetName === targetName) {
            if (closeHoverTimerRef.current) {
              window.clearTimeout(closeHoverTimerRef.current);
              closeHoverTimerRef.current = null;
            }
            return;
          }

          if (hoverTimerRef.current) {
            window.clearTimeout(hoverTimerRef.current);
          }

          const rect = wikilink.getBoundingClientRect();
          hoverTimerRef.current = window.setTimeout(async () => {
            const cleanTarget = targetName.toLowerCase();
            const matched =
              fileNotes?.find(
                (n) =>
                  n.name.replace(/\.md$/i, "").toLowerCase() === cleanTarget ||
                  n.id.toLowerCase() === cleanTarget
              ) || null;

            let excerpt = "";
            if (matched && matched.path) {
              try {
                const raw = await fileStore.readNote(matched.path);
                excerpt = stripMarkdownToPlainText(raw).slice(0, 260);
              } catch {
                excerpt = "无法读取笔记内容";
              }
            }

            const cardTop =
              rect.bottom + 8 + 180 > window.innerHeight
                ? Math.max(10, rect.top - 180)
                : rect.bottom + 8;
            const cardLeft = Math.max(16, Math.min(rect.left, window.innerWidth - 350));

            setHoverCard({
              open: true,
              targetName,
              matchedNote: matched,
              excerpt,
              position: { top: cardTop, left: cardLeft },
            });
          }, 300);
        } else {
          if (hoverTimerRef.current) {
            window.clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }
          if (hoverCard.open && !closeHoverTimerRef.current) {
            closeHoverTimerRef.current = window.setTimeout(() => {
              setHoverCard((prev) => ({ ...prev, open: false }));
              closeHoverTimerRef.current = null;
            }, 200);
          }
        }
      },
      [fileNotes, hoverCard.open, hoverCard.targetName]
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!editorRef.current) return;

      if (autocompleteState.open && suggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          confirmAutocomplete(suggestions[selectedSuggestionIndex]);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setAutocompleteState((prev) => ({ ...prev, open: false }));
          return;
        }
      }

      handleEditorKeyDown(event, {
        editor: editorRef.current,
        onFormat: format,
        onSave,
        onInput: handleInput,
        emitFormatState,
        flushPending,
        savedSelectionRef,
      });
    };

    const insertImage = useCallback((src: string, alt: string = "", title?: string) => {
      flushPending();
      const editor = editorRef.current;
      if (!editor) return;

      const newRange = insertImageDOM(editor, src, alt, title, {
        notebookPath,
        savedSelection: savedSelectionRef.current,
      });
      if (newRange) {
        savedSelectionRef.current = newRange.cloneRange();
      }

      const md = domToMarkdown(editor);
      lastRenderedContentRef.current = md;
      onChange(md);
      emitFormatState();
    }, [emitFormatState, flushPending, notebookPath, onChange]);

    const insertTable = useCallback((rows?: number, cols?: number) => {
      flushPending();
      const editor = editorRef.current;
      if (!editor) return;

      const newRange = insertTableDOM(editor, rows, cols, savedSelectionRef.current);
      if (newRange) {
        savedSelectionRef.current = newRange.cloneRange();
      }

      const md = domToMarkdown(editor);
      lastRenderedContentRef.current = md;
      onChange(md);
      emitFormatState();
    }, [emitFormatState, flushPending, onChange]);

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      }

      let imageFile: File | null = null;
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            imageFile = items[i].getAsFile();
            if (imageFile) break;
          }
        }
      }
      if (!imageFile && e.clipboardData?.files) {
        const files = e.clipboardData.files;
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith("image/")) {
            imageFile = files[i];
            break;
          }
        }
      }

      if (imageFile) {
        e.preventDefault();
        const file = imageFile;
        const timestamp = new Date().toISOString().replace(/T/, "_").replace(/[:.]/g, "-").slice(0, 19);
        const altText =
          file.name && file.name !== "image.png" && file.name !== "blob"
            ? file.name.replace(/\.[^/.]+$/, "")
            : `截图_${timestamp}`;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const result = evt.target?.result;
          if (typeof result === "string") {
            const isTauriEnv = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
            let targetSrc = result;
            if (isTauriEnv && notebookPath) {
              try {
                const sanitizedAlt = altText.replace(/[/\\:*?"<>|\s]/g, "_").slice(0, 50) || "image";
                const filename = `${sanitizedAlt}.png`;
                targetSrc = await fileStore.saveImageAsset(notebookPath, filename, result);
              } catch (err) {
                console.warn("保存本地图片资源失败，降级为 DataURL:", err);
              }
            }
            insertImage(targetSrc, altText);
            snackbar({ message: targetSrc.startsWith("./assets/") ? "已保存至本地 assets 并插入图片" : "已从剪贴板粘贴截图" });
            handleInput();
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        const doc = document as any;
        if (typeof doc.caretRangeFromPoint === "function") {
          const dropRange = doc.caretRangeFromPoint(e.clientX, e.clientY);
          if (dropRange) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(dropRange);
            savedSelectionRef.current = dropRange.cloneRange();
          }
        } else if (typeof doc.caretPositionFromPoint === "function") {
          const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
          if (pos && pos.offsetNode) {
            const dropRange = document.createRange();
            dropRange.setStart(pos.offsetNode, pos.offset);
            dropRange.setEnd(pos.offsetNode, pos.offset);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(dropRange);
            savedSelectionRef.current = dropRange.cloneRange();
          }
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const result = evt.target?.result;
          if (typeof result === "string") {
            const altText = file.name ? file.name.replace(/\.[^/.]+$/, "") : "image";
            const isTauriEnv = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
            let targetSrc = result;
            if (isTauriEnv && notebookPath) {
              try {
                const sanitizedAlt = altText.replace(/[/\\:*?"<>|\s]/g, "_").slice(0, 50) || "image";
                const filename = `${sanitizedAlt}.png`;
                targetSrc = await fileStore.saveImageAsset(notebookPath, filename, result);
              } catch (err) {
                console.warn("保存本地图片资源失败，降级为 DataURL:", err);
              }
            }
            insertImage(targetSrc, altText);
            snackbar({ message: targetSrc.startsWith("./assets/") ? "已保存至本地 assets 并插入图片" : "已插入图片" });
            handleInput();
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const handleInsertLink = (url: string, text: string) => {
      flushPending();
      const editor = editorRef.current;
      if (!editor) return;

      insertLinkDOM(editor, url, text, savedRangeRef.current);
      setLinkDialogOpen(false);

      const md = domToMarkdown(editor);
      lastRenderedContentRef.current = md;
      onChange(md);
      emitFormatState();
    };

    const format = (action: FormatAction) => {
      flushPending();
      const editor = editorRef.current;
      if (!editor) return;

      executeFormatAction(editor, action, {
        savedSelection: savedSelectionRef.current,
        notebookPath,
        onOpenLinkDialog: (text, range) => {
          savedRangeRef.current = range;
          setLinkText(text);
          setLinkUrl("https://");
          setLinkDialogOpen(true);
        },
        onOpenImageDialog: () => {
          setImageDialogOpen(true);
        },
        onOpenTableDialog: () => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
          }
          setTableDialogOpen(true);
        },
      });

      const md = domToMarkdown(editor);
      lastRenderedContentRef.current = md;
      onChange(md);
      emitFormatState();
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        target.tagName.toLowerCase() === "input" &&
        (target as HTMLInputElement).type === "checkbox"
      ) {
        const cb = target as HTMLInputElement;
        const parentLi = cb.closest("li");
        if (cb.checked) {
          cb.setAttribute("checked", "checked");
          parentLi?.classList.add("is-completed");
        } else {
          cb.removeAttribute("checked");
          parentLi?.classList.remove("is-completed");
        }
        if (debounceTimerRef.current) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        hasPendingChangesRef.current = false;
        if (editorRef.current) {
          const md = domToMarkdown(editorRef.current);
          lastRenderedContentRef.current = md;
          onChange(md);
        }
        emitFormatState();
        return;
      }

      const wikilink = target.closest(".ruvo-wikilink, .ruam-wikilink") as HTMLElement | null;
      if (wikilink) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          const targetName =
            wikilink.getAttribute("data-target") ||
            wikilink.textContent?.replace(/^\[\[|\]\]$/g, "").trim() ||
            "";
          if (targetName) {
            handleNavigateWikiLink(targetName);
          }
          return;
        }

        // Normal click: close hover preview card and allow caret placement inside for text editing
        setHoverCard((prev) => (prev.open ? { ...prev, open: false } : prev));
        emitFormatState();
        return;
      }
    };

    const handleCanvasOrContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // If the click is directly on the canvas or container (outside existing text elements)
      if (e.target === canvasRef.current || e.target === containerRef.current) {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();

        // Move caret to the very end of editor content
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        emitFormatState();
      }
    };

    useImperativeHandle(ref, () => ({
      format,
      focus: () => {
        flushPending();
        editorRef.current?.focus();
      },
      insertImage,
      insertTable,
      flush: flushPending,
    }));

    return (
      <div
        ref={canvasRef}
        className="notebooklm-canvas"
        onClick={handleCanvasOrContainerClick}
      >
        <div
          ref={containerRef}
          className="notebooklm-editor-container"
          onClick={handleCanvasOrContainerClick}
        >
          <div
            ref={editorRef}
            className="notebooklm-editor"
            role="textbox"
            aria-label="NotebookLM 笔记编辑区"
            contentEditable
            suppressContentEditableWarning
            spellCheck={settings.spellcheck}
            lang={settings.spellcheck ? "en-US" : "zh-CN"}
            onInput={handleInput}
            onBlur={flushPending}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onKeyUp={() => {
              emitFormatState();
              if (!isComposingRef.current) {
                checkWikiLinkTrigger();
              }
            }}
            onMouseMove={handleMouseMove}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              checkWikiLinkTrigger();
            }}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onMouseDown={() => {
              if (editorRef.current) {
                ensureTrailingBoundary(editorRef.current);
              }
            }}
            onMouseUp={emitFormatState}
          />
        </div>

        <LinkInsertDialog
          open={linkDialogOpen}
          initialText={linkText}
          initialUrl={linkUrl}
          onClose={() => setLinkDialogOpen(false)}
          onInsert={handleInsertLink}
        />

        <ImageInsertDialog
          open={imageDialogOpen}
          onClose={() => setImageDialogOpen(false)}
          onInsert={(src, alt, title) => {
            setImageDialogOpen(false);
            insertImage(src, alt, title);
          }}
        />

        <TableInsertDialog
          open={tableDialogOpen}
          onClose={() => setTableDialogOpen(false)}
          onInsert={(rows, cols) => {
            setTableDialogOpen(false);
            insertTable(rows, cols);
          }}
        />

        <WikiLinkAutocomplete
          open={autocompleteState.open}
          query={autocompleteState.query}
          position={autocompleteState.position}
          suggestions={suggestions}
          selectedIndex={selectedSuggestionIndex}
          onSelect={confirmAutocomplete}
          onHoverIndex={setSelectedSuggestionIndex}
        />

        <WikiLinkHoverCard
          open={hoverCard.open}
          targetName={hoverCard.targetName}
          position={hoverCard.position}
          matchedNote={hoverCard.matchedNote}
          targetNote={hoverCard.matchedNote}
          excerpt={hoverCard.excerpt}
          onNavigate={handleNavigateWikiLink}
          onSelectNote={(noteId) => handleNavigateWikiLink(noteId)}
          onCreate={(name) => {
            onCreateNote?.(name);
            setHoverCard((prev) => ({ ...prev, open: false }));
          }}
          onMouseEnter={() => {
            if (closeHoverTimerRef.current) {
              window.clearTimeout(closeHoverTimerRef.current);
              closeHoverTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            closeHoverTimerRef.current = window.setTimeout(() => {
              setHoverCard((prev) => ({ ...prev, open: false }));
              closeHoverTimerRef.current = null;
            }, 200);
          }}
        />
      </div>
    );
  }
);

NotebookLMEditor.displayName = "NotebookLMEditor";

export default NotebookLMEditor;
