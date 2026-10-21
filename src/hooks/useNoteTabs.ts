import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirm, snackbar } from "mdui";
import type { FileNote, LocalNote, RenamedNote, RequestedNote } from "../types";
import { subscribeNoteChange } from "../services/noteSync";

export const isSameId = (a?: string | null, b?: string | null): boolean => {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();
};

export interface UseNoteTabsOptions {
  fileNotes?: FileNote[];
  renamedNote?: RenamedNote | null;
  requestedNote?: RequestedNote | null;
  onReadNote?: (note: FileNote) => Promise<string>;
  onSaveNote?: (note: LocalNote) => Promise<boolean>;
  onNotice?: (message: string) => void;
  onSaveStateChange?: (state: "saved" | "saving" | "unsaved") => void;
  onActiveNoteChange?: (noteId: string | null) => void;
  onNotesChange?: (notes: LocalNote[], activeId: string | null) => void;
  onCloseNoteTab?: (noteId: string) => void;
}

export function useNoteTabs({
  fileNotes,
  renamedNote,
  requestedNote,
  onReadNote,
  onSaveNote,
  onNotice,
  onSaveStateChange,
  onActiveNoteChange,
  onNotesChange,
  onCloseNoteTab,
}: UseNoteTabsOptions = {}) {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const openTabIdsRef = useRef(openTabIds);
  openTabIdsRef.current = openTabIds;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const onSaveNoteRef = useRef(onSaveNote);
  onSaveNoteRef.current = onSaveNote;
  const onNoticeRef = useRef(onNotice);
  onNoticeRef.current = onNotice;
  const onSaveStateChangeRef = useRef(onSaveStateChange);
  onSaveStateChangeRef.current = onSaveStateChange;
  const onCloseNoteTabRef = useRef(onCloseNoteTab);
  onCloseNoteTabRef.current = onCloseNoteTab;
  const loadedNoteIdsRef = useRef<Set<string>>(new Set());
  const lastRequestedNoteIdRef = useRef<string | null>(null);
  const closedNoteIdsRef = useRef<Set<string>>(new Set());

  // Derived tabs and active note
  const tabs = useMemo(
    () =>
      openTabIds
        .map((id) => notes.find((note) => isSameId(note.id, id) || isSameId(note.path, id)))
        .filter((note): note is LocalNote => Boolean(note)),
    [notes, openTabIds]
  );

  const activeNote = useMemo(
    () => notes.find((note) => isSameId(note.id, activeTabId) || isSameId(note.path, activeTabId)) ?? null,
    [notes, activeTabId]
  );

  const isDirty = useMemo(
    () =>
      Boolean(
        activeNote &&
          activeNote.savedContent !== undefined &&
          activeNote.content !== activeNote.savedContent
      ),
    [activeNote]
  );

  // Synchronize with fileNotes and renamedNote
  useEffect(() => {
    if (!fileNotes) return;
    setNotes((currentNotes) => {
      return fileNotes.map((fn) => {
        const isRenamed = Boolean(
          renamedNote &&
            (fn.id === renamedNote.newNote.id || fn.path === renamedNote.newNote.path) &&
            !currentNotes.some((cn) => cn.id === fn.id || cn.path === fn.path)
        );
        const existing = currentNotes.find(
          (cn) =>
            cn.id === fn.id ||
            cn.path === fn.path ||
            (isRenamed && (cn.path === renamedNote?.oldPath || cn.id === renamedNote?.oldPath))
        );
        const content = existing?.content ?? "";
        const savedContent =
          existing?.savedContent !== undefined
            ? existing.savedContent
            : existing
            ? existing.content
            : fn.id === activeTabId
            ? ""
            : undefined;

        return {
          id: fn.id,
          name: fn.name,
          path: fn.path,
          notebookId: fn.notebookId,
          content,
          savedContent,
        };
      });
    });

    const validIds = new Set(fileNotes.map((fn) => fn.id));
    setOpenTabIds((currentTabs) => {
      const mapped = renamedNote
        ? currentTabs.map((id) => (id === renamedNote.oldPath ? renamedNote.newNote.id : id))
        : currentTabs;
      return mapped.filter((id) => validIds.has(id));
    });

    if (renamedNote) {
      setActiveTabId((currentActive) =>
        currentActive === renamedNote.oldPath ? renamedNote.newNote.id : currentActive
      );
    }
  }, [fileNotes, renamedNote, activeTabId]);

  // Fallback active tab if current tab is closed
  useEffect(() => {
    if (activeTabId && !openTabIds.some((id) => isSameId(id, activeTabId))) {
      setActiveTabId(openTabIds[openTabIds.length - 1] ?? null);
    }
  }, [openTabIds, activeTabId]);

  // Synchronize requestedNote & read content
  useEffect(() => {
    if (!requestedNote) {
      lastRequestedNoteIdRef.current = null;
      return;
    }

    const normReqId = requestedNote.id.replace(/\\/g, "/").toLowerCase();
    const normReqPath = requestedNote.path ? requestedNote.path.replace(/\\/g, "/").toLowerCase() : normReqId;

    const isNewRequest = !isSameId(lastRequestedNoteIdRef.current, requestedNote.id);
    lastRequestedNoteIdRef.current = requestedNote.id;

    if (isNewRequest) {
      closedNoteIdsRef.current.delete(normReqId);
      closedNoteIdsRef.current.delete(normReqPath);
    } else if (closedNoteIdsRef.current.has(normReqId) || closedNoteIdsRef.current.has(normReqPath)) {
      return;
    }

    // If this requestedNote was already handled and the tab is currently closed, do not re-open it
    if (!isNewRequest && !openTabIdsRef.current.some((id) => isSameId(id, requestedNote.id))) {
      return;
    }

    const existing = notesRef.current.find(
      (note) => isSameId(note.id, requestedNote.id) || isSameId(note.path, requestedNote.path)
    );
    if (!existing) {
      setNotes((current) => [
        ...current,
        {
          id: requestedNote.id,
          name: requestedNote.name,
          path: requestedNote.path,
          content: "",
          savedContent: "",
        },
      ]);
    } else if (existing.savedContent === undefined) {
      setNotes((current) =>
        current.map((n) =>
          (isSameId(n.id, requestedNote.id) || isSameId(n.path, requestedNote.path)) && n.savedContent === undefined
            ? { ...n, savedContent: n.content ?? "" }
            : n
        )
      );
    }

    setOpenTabIds((current) =>
      current.some((id) => isSameId(id, requestedNote.id)) ? current : [...current, requestedNote.id]
    );
    setActiveTabId(requestedNote.id);

    if (onReadNote && requestedNote.path) {
      const isAlreadyLoaded =
        loadedNoteIdsRef.current.has(requestedNote.id) ||
        (existing && existing.savedContent !== undefined && existing.content !== "");
      if (!isAlreadyLoaded) {
        loadedNoteIdsRef.current.add(requestedNote.id);
        const targetFileNote: FileNote = fileNotes?.find((note) => note.id === requestedNote.id) ?? {
          id: requestedNote.id,
          name: requestedNote.name,
          path: requestedNote.path,
          notebookId: "",
          notebookName: "",
        };
        onReadNote(targetFileNote)
          .then((content) => {
            setNotes((current) =>
              current.map((note) =>
                note.id === requestedNote.id
                  ? { ...note, content, savedContent: content }
                  : note
              )
            );
            onSaveStateChangeRef.current?.("saved");
          })
          .catch(() => {
            onNoticeRef.current?.("无法读取笔记");
            snackbar({ message: "无法读取笔记" });
            setNotes((current) =>
              current.map((note) =>
                note.id === requestedNote.id
                  ? { ...note, savedContent: note.content ?? "" }
                  : note
              )
            );
          });
      }
    } else {
      loadedNoteIdsRef.current.add(requestedNote.id);
    }
  }, [requestedNote, fileNotes, onReadNote]);

  // Notify active tab and notes changes
  useEffect(() => {
    onActiveNoteChange?.(activeTabId);
  }, [activeTabId, onActiveNoteChange]);

  useEffect(() => {
    onNotesChange?.(notes, activeTabId);
  }, [notes, activeTabId, onNotesChange]);

  // Real-time synchronization from other windows (e.g. sticky notes)
  useEffect(() => {
    const unsubscribe = subscribeNoteChange((changedPath, newContent) => {
      setNotes((current) =>
        current.map((n) =>
          isSameId(n.path, changedPath) || isSameId(n.id, changedPath)
            ? { ...n, content: newContent, savedContent: newContent }
            : n
        )
      );
    });
    return unsubscribe;
  }, []);

  // Actions
  const updateNoteContent = useCallback((content: string, id?: string) => {
    const targetId = id ?? activeTabIdRef.current;
    if (!targetId) return;
    setNotes((current) => {
      const next = current.map((note) => (note.id === targetId ? { ...note, content } : note));
      notesRef.current = next;
      return next;
    });
  }, []);

  const markNoteSaved = useCallback((noteId: string, savedContent?: string) => {
    setNotes((current) => {
      const next = current.map((n) =>
        n.id === noteId
          ? { ...n, savedContent: savedContent !== undefined ? savedContent : n.content }
          : n
      );
      notesRef.current = next;
      return next;
    });
  }, []);

  const closeTab = useCallback(async (tabId: string, force = false) => {
    const target = notesRef.current.find((note) => isSameId(note.id, tabId) || isSameId(note.path, tabId));
    if (!force && target && target.savedContent !== undefined && target.content !== target.savedContent) {
      const saved = onSaveNoteRef.current ? await onSaveNoteRef.current(target) : true;
      if (!saved) {
        try {
          await confirm({
            headline: "未保存修改",
            description: `“${target.name}”自动保存失败，有未保存的修改，仍要关闭吗？`,
            confirmText: "仍然关闭",
            cancelText: "取消",
          });
        } catch {
          return;
        }
      }
    }

    // Mark as closed in blacklist so requestedNote won't resurrect it
    const norm = tabId.replace(/\\/g, "/").toLowerCase();
    closedNoteIdsRef.current.add(norm);
    if (target?.path) {
      closedNoteIdsRef.current.add(target.path.replace(/\\/g, "/").toLowerCase());
    }
    if (target?.id) {
      closedNoteIdsRef.current.add(target.id.replace(/\\/g, "/").toLowerCase());
    }

    const currentTabs = openTabIdsRef.current;
    const isTargetTab = (id: string) =>
      isSameId(id, tabId) ||
      (target ? isSameId(id, target.id) || isSameId(id, target.path) : false);

    const index = currentTabs.findIndex(isTargetTab);
    const remaining = currentTabs.filter((id) => !isTargetTab(id));
    openTabIdsRef.current = remaining;
    setOpenTabIds(remaining);

    const isCurrentActive =
      isSameId(tabId, activeTabIdRef.current) ||
      (target ? isSameId(activeTabIdRef.current, target.id) || isSameId(activeTabIdRef.current, target.path) : false);

    if (isCurrentActive) {
      const nextActive = remaining[index] ?? remaining[index - 1] ?? remaining[remaining.length - 1] ?? null;
      activeTabIdRef.current = nextActive;
      setActiveTabId(nextActive);
      onActiveNoteChange?.(nextActive);
    }
    onCloseNoteTabRef.current?.(tabId);
    if (target?.id && target.id !== tabId) {
      onCloseNoteTabRef.current?.(target.id);
    }
    if (target?.path && target.path !== tabId) {
      onCloseNoteTabRef.current?.(target.path);
    }
  }, [onActiveNoteChange]);

  const closeOtherTabs = useCallback(async () => {
    const currentActive = notesRef.current.find((n) => n.id === activeTabIdRef.current) ?? null;
    if (!currentActive) return;
    const currentTabs = openTabIdsRef.current
      .map((id) => notesRef.current.find((n) => n.id === id))
      .filter((n): n is LocalNote => Boolean(n));
    const dirtyOthers = currentTabs.filter(
      (note) =>
        note.id !== currentActive.id &&
        note.savedContent !== undefined &&
        note.content !== note.savedContent
    );
    for (const note of dirtyOthers) {
      const saved = onSaveNoteRef.current ? await onSaveNoteRef.current(note) : true;
      if (!saved) {
        try {
          await confirm({
            headline: "未保存修改",
            description: `“${note.name}”有未保存的修改，仍要关闭吗？`,
            confirmText: "仍然关闭",
            cancelText: "取消",
          });
        } catch {
          return;
        }
      }
    }
    setOpenTabIds([currentActive.id]);
    onNoticeRef.current?.("已关闭其他标签");
    snackbar({ message: "已关闭其他标签" });
  }, []);

  const copyNoteName = useCallback(async () => {
    const currentActive = notesRef.current.find((n) => n.id === activeTabIdRef.current) ?? null;
    if (!currentActive) return;
    const cleanName = currentActive.name.replace(/\.md$/i, "");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(cleanName);
      onNoticeRef.current?.("笔记名称已复制");
      snackbar({ message: "笔记名称已复制" });
    } catch {
      onNoticeRef.current?.(cleanName);
      snackbar({ message: cleanName });
    }
  }, []);

  return {
    notes,
    setNotes,
    notesRef,
    openTabIds,
    setOpenTabIds,
    openTabIdsRef,
    activeTabId,
    setActiveTabId,
    activeTabIdRef,
    tabs,
    activeNote,
    isDirty,
    closeTab,
    closeOtherTabs,
    copyNoteName,
    copyName: copyNoteName,
    updateNoteContent,
    markNoteSaved,
  };
}
