import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  usePanelRef,
} from "react-resizable-panels";
import ActivityBar from "./ActivityBar";
import TitleBar from "./TitleBar";
import WindowResizeHandles from "./WindowResizeHandles";
import LeftSidebar from "../sidebar/LeftSidebar";
import MainStage from "../stage/MainStage";
import RightSidebar from "../context/RightSidebar";
import StatusBar from "./StatusBar";
import { useNotebooks } from "../../hooks/useNotebooks";
import { useNotes } from "../../hooks/useNotes";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { getOutline, getBacklinks } from "../../utils/markdownAnalysis";
import { snackbar } from "mdui";
import { fileStore } from "../../services/fileStore";
import {
  broadcastAppClosing,
  broadcastNoteChange,
  subscribeRestoreToFileBar,
} from "../../services/noteSync";
import { isSameId } from "../../hooks/useNoteTabs";
import { toggleThemeWithTransition } from "../../utils/theme";
import { checkForUpdates } from "../../services/updaterService";
import { getCurrentWindow } from "@tauri-apps/api/window";
import SettingsApp from "../settings/SettingsApp";
import { useRuvoSettings } from "../settings/settingsStore";
import type {
  ActivityBarTab,
  FileNote,
  LocalNote,
  RenamedNote,
  RequestedHeading,
  RequestedNote,
  StageStatus,
  TreeItem,
} from "../../types";
import "../../styles/m3-layout.css";

export default function AppLayout() {
  const { settings, updateSettings } = useRuvoSettings();
  const theme = settings.theme;
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ActivityBarTab>("notes");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [requestedNote, setRequestedNote] = useState<RequestedNote | null>(null);
  const [requestedHeading, setRequestedHeading] = useState<RequestedHeading | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [renamedNote, setRenamedNote] = useState<RenamedNote | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [noteSnapshot, setNoteSnapshot] = useState<{ notes: LocalNote[]; activeId: string | null }>({
    notes: [],
    activeId: null,
  });
  const [closeTabRequestedId, setCloseTabRequestedId] = useState<string | null>(null);
  const [stageStatus, setStageStatus] = useState<StageStatus>({
    noteName: null,
    notePath: null,
    wordCount: 0,
    isDirty: false,
    message: "",
    saveState: "saved",
  });
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const saveActiveNoteRef = useRef<(() => Promise<boolean>) | null>(null);
  const confirmDialogRef = useRef<HTMLElement>(null);

  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  const { notebooks, activeNotebook, selectNotebook, createNotebook, deleteNotebook } = useNotebooks();
  const { fileNotes, createNote, renameNote, deleteNote } = useNotes(activeNotebook);

  // 首次打开软件或切换笔记本时，若当前未打开笔记，自动打开第一篇笔记（如示例笔记）
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasAutoOpenedRef.current && fileNotes.length > 0 && !selectedNoteId && !requestedNote) {
      hasAutoOpenedRef.current = true;
      const targetNote = fileNotes.find((n) => n.name.includes("欢迎") || n.name.includes("示例")) ?? fileNotes[0];
      setSelectedNoteId(targetNote.id);
      setRequestedNote({ id: targetNote.id, name: targetNote.name, path: targetNote.path });
    }
  }, [fileNotes, selectedNoteId, requestedNote]);

  const activeNote = noteSnapshot.notes.find((note) => note.id === noteSnapshot.activeId) ?? null;

  const [debouncedActiveContent, setDebouncedActiveContent] = useState(activeNote?.content ?? "");
  const [debouncedNotes, setDebouncedNotes] = useState(noteSnapshot.notes);
  const [debouncedActiveNote, setDebouncedActiveNote] = useState(activeNote);
  const prevActiveIdRef = useRef<string | null>(activeNote?.id ?? null);

  useEffect(() => {
    const isNoteSwitch = prevActiveIdRef.current !== (activeNote?.id ?? null);
    prevActiveIdRef.current = activeNote?.id ?? null;

    if (isNoteSwitch) {
      setDebouncedActiveContent(activeNote?.content ?? "");
      setDebouncedNotes(noteSnapshot.notes);
      setDebouncedActiveNote(activeNote);
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedActiveContent(activeNote?.content ?? "");
      setDebouncedNotes(noteSnapshot.notes);
      setDebouncedActiveNote(activeNote);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeNote, noteSnapshot.notes]);

  const outlineItems = useMemo(
    () => (rightOpen ? getOutline(debouncedActiveContent) : []),
    [debouncedActiveContent, rightOpen]
  );
  const backlinks = useMemo(
    () => (rightOpen ? getBacklinks(debouncedNotes, debouncedActiveNote) : []),
    [debouncedNotes, debouncedActiveNote, rightOpen]
  );

  const onNotesChange = useCallback((notes: LocalNote[], activeId: string | null) => {
    setNoteSnapshot({ notes, activeId });
  }, []);

  const noteSnapshotRef = useRef(noteSnapshot);
  noteSnapshotRef.current = noteSnapshot;

  const getLatestNoteContent = useCallback(
    async (target: TreeItem): Promise<string> => {
      const snapshot = noteSnapshotRef.current;
      const isTargetActive =
        (Boolean(target.id) && target.id === snapshot.activeId) ||
        (Boolean(target.path) && Boolean(activeNote?.path) && target.path === activeNote?.path);

      const openNote = snapshot.notes.find(
        (n) =>
          (target.id && n.id === target.id) ||
          (target.path && n.path && n.path === target.path)
      );

      if (isTargetActive || openNote) {
        if (saveActiveNoteRef.current) {
          await saveActiveNoteRef.current();
        }

        const latestSnapshot = noteSnapshotRef.current;
        const currentOpenNote = latestSnapshot.notes.find(
          (n) =>
            (target.id && n.id === target.id) ||
            (target.path && n.path && n.path === target.path)
        );
        if (currentOpenNote) {
          return currentOpenNote.content;
        }
        if (openNote) {
          return openNote.content;
        }
        if (activeNote && (target.id === activeNote.id || target.path === activeNote.path)) {
          return activeNote.content;
        }
      }

      if (target.path) {
        return await fileStore.readNote(target.path);
      }
      return "";
    },
    [activeNote]
  );

  const sidebarNotes = useMemo(() => {
    return fileNotes.map((note) => ({
      id: note.id,
      label: note.name,
      path: note.path,
      type: "file" as const,
    }));
  }, [fileNotes]);

  // Scroll Spy: 匹配并高亮当前正文视口顶部对应的标题大纲项
  const handleActiveHeadingChange = useCallback(
    (cleanText: string, index: number) => {
      if (!outlineItems || outlineItems.length === 0) return;
      const byIndex = outlineItems[index];
      if (byIndex && byIndex.label.trim().toLowerCase() === cleanText.toLowerCase()) {
        setActiveHeadingId(byIndex.id);
        return;
      }
      const byText = outlineItems.find(
        (item) => item.label.trim().toLowerCase() === cleanText.toLowerCase()
      );
      if (byText) {
        setActiveHeadingId(byText.id);
      } else if (byIndex) {
        setActiveHeadingId(byIndex.id);
      }
    },
    [outlineItems]
  );

  const handleSelectNotebook = useCallback((notebook: typeof notebooks[0]) => {
    selectNotebook(notebook);
    setRequestedNote(null);
    setSelectedNoteId(null);
    setRenamedNote(null);
    setActiveHeadingId(null);
    hasAutoOpenedRef.current = false;
  }, [selectNotebook]);

  const handleDeleteNotebook = useCallback(async (notebook: typeof notebooks[0]) => {
    if (activeNotebook?.id === notebook.id) {
      setSelectedNoteId(null);
      setRequestedNote(null);
      setRenamedNote(null);
      setActiveHeadingId(null);
    }
    await deleteNotebook(notebook);
  }, [activeNotebook, deleteNotebook]);

  const handleCreateNote = useCallback(async (requestedName?: string) => {
    const note = await createNote(requestedName);
    if (note) {
      setSelectedNoteId(note.id);
      setRequestedNote(note);
    }
  }, [createNote]);

  const handleSelectNoteFromStage = useCallback((note: FileNote) => {
    setSelectedNoteId(note.id);
    setRequestedNote({ id: note.id, name: note.name, path: note.path });
  }, []);

  const handleRenameNote = useCallback(async (note: TreeItem, newName: string) => {
    if (!note.path) return;

    // 1. If this note has unsaved changes in memory, save it to disk before renaming
    const inMemNote = noteSnapshot.notes.find((n) => n.path === note.path || n.id === note.id);
    if (inMemNote && inMemNote.savedContent !== undefined && inMemNote.content !== inMemNote.savedContent) {
      try {
        await fileStore.writeNote(note.path, inMemNote.content);
      } catch (err) {
        console.error("Failed to save note before rename:", err);
      }
    }

    // 2. Rename note on disk
    const updated = await renameNote(note.path, newName);
    if (updated) {
      setRenamedNote({ oldPath: note.path, newNote: updated });
      if (selectedNoteId === note.id || noteSnapshot.activeId === note.id) {
        setSelectedNoteId(updated.id);
        setRequestedNote(updated);
      }
    }
  }, [noteSnapshot, renameNote, selectedNoteId]);

  const handleDeleteNote = useCallback(async (note: TreeItem) => {
    if (!note.path) return;
    const success = await deleteNote(note.path, note.label);
    if (success && selectedNoteId === note.id) {
      setSelectedNoteId(null);
      setRequestedNote(null);
    }
  }, [deleteNote, selectedNoteId]);

  const handleCloseNoteTab = useCallback((closedId: string) => {
    const normClosed = closedId.replace(/\\/g, "/").toLowerCase();
    setRequestedNote((curr) => {
      if (!curr) return null;
      const isMatch =
        curr.id.replace(/\\/g, "/").toLowerCase() === normClosed ||
        (Boolean(curr.path) && curr.path!.replace(/\\/g, "/").toLowerCase() === normClosed);
      return isMatch ? null : curr;
    });
    setSelectedNoteId((curr) => {
      if (!curr) return null;
      const isMatch = curr.replace(/\\/g, "/").toLowerCase() === normClosed;
      return isMatch ? null : curr;
    });
    setCloseTabRequestedId(null);
  }, []);

  const handleOpenStickyNote = useCallback(
    async (note: TreeItem) => {
      if (!note.path) return;
      handleCloseNoteTab(note.id);
      if (note.path !== note.id) {
        handleCloseNoteTab(note.path);
      }
      setCloseTabRequestedId(note.id);
      try {
        const noteName = (note as any).name || note.label;
        await fileStore.openStickyNoteWindow(note.path, noteName);
      } catch (err) {
        console.error("打开便签失败:", err);
      }
    },
    [handleCloseNoteTab]
  );

  const handleReadNote = useCallback((note: FileNote) => fileStore.readNote(note.path), []);
  const handleWriteNote = useCallback(
    async (note: LocalNote, content: string) => {
      if (!note.path) throw new Error("笔记路径不可用");
      await fileStore.writeNote(note.path, content);
      broadcastNoteChange(note.path, content);
    },
    []
  );

  // Listen to sticky note "insert back to file bar" and main window close broadcasting
  useEffect(() => {
    const unsubRestore = subscribeRestoreToFileBar((path, title) => {
      const matched = fileNotes.find((n) => isSameId(n.path, path) || isSameId(n.id, path));
      const targetId = matched?.id || path;
      const targetTitle = matched?.name || title;

      setCloseTabRequestedId(null);
      setSelectedNoteId(targetId);
      setRequestedNote({
        id: targetId,
        path,
        name: targetTitle,
      });

      // Bring main window to foreground
      fileStore.focusMainWindow().catch(() => {});

      snackbar({
        message: `已将笔记“${targetTitle.replace(/\.md$/i, "")}”插入回文件栏`,
        placement: "top",
      });
    });

    const handleBeforeUnload = () => {
      broadcastAppClosing();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubRestore();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [fileNotes]);

  useEffect(() => {
    if (!confirmDialogRef.current) return;
    (confirmDialogRef.current as any).open = isConfirmCloseOpen;
  }, [isConfirmCloseOpen]);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;
    const handleClosed = () => {
      setIsConfirmCloseOpen(false);
    };
    dialog.addEventListener("closed", handleClosed);
    return () => {
      dialog.removeEventListener("closed", handleClosed);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) return;
    let unlisten: (() => void) | undefined;
    try {
      const unlistenPromise = getCurrentWindow().onCloseRequested(async (event: any) => {
        if (stageStatus.isDirty) {
          event.preventDefault();
          setIsConfirmCloseOpen(true);
        }
      });
      unlistenPromise
        .then((fn: any) => {
          unlisten = fn;
        })
        .catch((err: any) => {
          console.warn("Failed to listen to onCloseRequested:", err);
        });
    } catch (err) {
      console.warn("Failed to setup onCloseRequested:", err);
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [stageStatus.isDirty]);

  const handleRequestClose = useCallback(async () => {
    if (stageStatus.isDirty) {
      setIsConfirmCloseOpen(true);
    } else {
      try {
        if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
          await getCurrentWindow().close();
        } else {
          window.close();
        }
      } catch (err) {
        console.warn("Failed to close window:", err);
      }
    }
  }, [stageStatus.isDirty]);

  const handleSaveAndExit = useCallback(async () => {
    try {
      if (saveActiveNoteRef.current) {
        await saveActiveNoteRef.current();
      }
      const dirtyNotes = noteSnapshot.notes.filter(
        (n) => n.path && n.savedContent !== undefined && n.content !== n.savedContent
      );
      for (const note of dirtyNotes) {
        if (note.path) {
          await fileStore.writeNote(note.path, note.content);
          broadcastNoteChange(note.path, note.content);
        }
      }
    } catch (err) {
      console.error("Failed to save note before exit:", err);
    }
    broadcastAppClosing();
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        await getCurrentWindow().destroy();
      } else {
        window.close();
      }
    } catch (err) {
      console.error("Failed to destroy window:", err);
    }
  }, [noteSnapshot.notes]);

  const handleDirectExit = useCallback(async () => {
    broadcastAppClosing();
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        await getCurrentWindow().destroy();
      } else {
        window.close();
      }
    } catch (err) {
      console.error("Failed to destroy window:", err);
    }
  }, []);

  const handleRegisterSaveActive = useCallback((saveFn: () => Promise<boolean>) => {
    saveActiveNoteRef.current = saveFn;
  }, []);

  const toggleLeftPanel = useCallback(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setLeftOpen(true);
    } else {
      panel.collapse();
      setLeftOpen(false);
    }
  }, [leftPanelRef]);

  const toggleRightPanel = useCallback(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setRightOpen(true);
    } else {
      panel.collapse();
      setRightOpen(false);
    }
  }, [rightPanelRef]);

  const handleToggleTheme = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      const origin = e
        ? { x: e.clientX, y: e.clientY }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      void toggleThemeWithTransition(
        theme,
        origin,
        (next) => {
          updateSettings({ theme: next });
        },
        settings.circleAnimation
      );
    },
    [theme, settings.circleAnimation, updateSettings]
  );

  const handleOpenSettings = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_settings_window");
      } else {
        setShowSettingsModal(true);
      }
    } catch (err) {
      console.warn("Could not open settings window via Tauri, showing modal:", err);
      setShowSettingsModal(true);
    }
  }, []);

  const handleSelectTab = useCallback(
    (tab: ActivityBarTab) => {
      if (activeTab === tab && leftOpen) {
        toggleLeftPanel();
      } else {
        setActiveTab(tab);
        if (!leftOpen) {
          leftPanelRef.current?.expand();
          setLeftOpen(true);
        }
      }
    },
    [activeTab, leftOpen, toggleLeftPanel, leftPanelRef]
  );

  const handleOpenSearch = useCallback(() => {
    setActiveTab("search");
    const panel = leftPanelRef.current;
    if (panel?.isCollapsed()) {
      panel.expand();
      setLeftOpen(true);
    } else if (!leftOpen) {
      panel?.expand();
      setLeftOpen(true);
    }
  }, [leftOpen, leftPanelRef]);

  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const activeNoteTitle = activeNote?.name ?? stageStatus.noteName ?? null;

  // 启动时静默检查更新（延迟 3.5 秒执行）
  useEffect(() => {
    if (!settings.autoCheckUpdate) return;
    const timer = window.setTimeout(async () => {
      try {
        const state = await checkForUpdates(false);
        if (state.phase === "available") {
          snackbar({
            message: `发现 Ruvo 新版本 v${state.newVersion}！`,
            action: "查看更新",
            onActionClick: () => {
              void handleOpenSettings();
            },
          });
        }
      } catch {
        // silent
      }
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [settings.autoCheckUpdate, handleOpenSettings]);

  useKeyboardShortcuts({
    onToggleLeft: toggleLeftPanel,
    onToggleRight: toggleRightPanel,
    onCreateNote: handleCreateNote,
    onOpenSearch: handleOpenSearch,
    onOpenSettings: handleOpenSettings,
  });

  return (
    <main className={`app-layout ${isWindowMaximized ? "is-maximized" : ""}`}>
      <WindowResizeHandles isMaximized={isWindowMaximized} />
      <TitleBar
        activeNotebookName={activeNotebook?.name}
        activeNoteName={activeNoteTitle}
        isDirty={stageStatus.isDirty}
        onOpenSearch={handleOpenSearch}
        onOpenSettings={handleOpenSettings}
        onMaximizedChange={setIsWindowMaximized}
        onClose={handleRequestClose}
      />
      <div className="layout-workspace">
        <ActivityBar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={handleOpenSettings}
        />

        <PanelGroup orientation="horizontal" className="layout-panels" id="ruvo-layout">
          <Panel
            id="left-sidebar"
            panelRef={leftPanelRef}
            defaultSize="23%"
            minSize="16%"
            maxSize="34%"
            collapsedSize="0%"
            collapsible
            onResize={(size) => setLeftOpen(size.asPercentage > 0.5)}
            className="layout-panel"
          >
            <LeftSidebar
              onCollapse={toggleLeftPanel}
              notes={sidebarNotes}
              notebooks={notebooks}
              activeNotebookId={activeNotebook?.id}
              onSelectNotebook={handleSelectNotebook}
              onCreateNotebook={() => void createNotebook()}
              onDeleteNotebook={handleDeleteNotebook}
              selectedNoteId={selectedNoteId}
              onSelectNote={(note) => {
                setSelectedNoteId(note.id);
                setRequestedNote({ id: note.id, name: note.label, path: note.path });
              }}
              onCreateNote={() => void handleCreateNote()}
              onRenameNote={handleRenameNote}
              onDeleteNote={handleDeleteNote}
              onOpenStickyNote={handleOpenStickyNote}
              getLatestNoteContent={getLatestNoteContent}
            />
          </Panel>

          <PanelResizeHandle
            className="resize-handle"
            aria-label="调整左侧栏宽度"
            title="双击折叠/展开左侧栏"
            onDoubleClick={toggleLeftPanel}
          />

          <Panel id="main-stage" minSize="35%" className="layout-panel">
            <MainStage
              requestedNote={requestedNote}
              requestedHeading={requestedHeading}
              fileNotes={fileNotes}
              renamedNote={renamedNote}
              onReadNote={handleReadNote}
              onWriteNote={handleWriteNote}
              onActiveNoteChange={setSelectedNoteId}
              onNotesChange={onNotesChange}
              onStatusChange={setStageStatus}
              onActiveHeadingChange={handleActiveHeadingChange}
              rightOpen={rightOpen}
              onToggleRight={toggleRightPanel}
              onCreateNote={() => void handleCreateNote()}
              onCloseNoteTab={handleCloseNoteTab}
              closeTabRequestedId={closeTabRequestedId}
              onSelectNote={handleSelectNoteFromStage}
              onCreateNoteWithName={(name) => void handleCreateNote(name)}
              onRegisterSaveActive={handleRegisterSaveActive}
              onOpenSettings={handleOpenSettings}
            />
          </Panel>

          <PanelResizeHandle
            className="resize-handle"
            aria-label="调整右侧栏宽度"
            title="双击折叠/展开右侧栏"
            onDoubleClick={toggleRightPanel}
          />

          <Panel
            id="right-sidebar"
            panelRef={rightPanelRef}
            defaultSize="22%"
            minSize="16%"
            maxSize="34%"
            collapsedSize="0%"
            collapsible
            onResize={(size) => setRightOpen(size.asPercentage > 0.5)}
            className="layout-panel"
          >
            <RightSidebar
              onClose={toggleRightPanel}
              outlineItems={outlineItems}
              backlinks={backlinks}
              activeHeadingId={activeHeadingId}
              onBacklinkSelect={(link) => {
                const note = fileNotes.find((item) => item.id === link.id);
                setSelectedNoteId(link.id);
                setRequestedNote({ id: link.id, name: link.title, path: note?.path });
              }}
              onOutlineSelect={(item) => setRequestedHeading({ label: item.label })}
            />
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar status={stageStatus} fallbackPath={activeNotebook?.path} />
      <mdui-dialog
        ref={confirmDialogRef as any}
        open={isConfirmCloseOpen ? true : undefined}
        headline="有未保存的更改"
        description="当前笔记存在未保存的修改。如果直接退出，最新的更改将会丢失。请选择操作："
        close-on-esc
        close-on-overlay-click
      >
        <mdui-button
          slot="action"
          variant="filled"
          onClick={handleSaveAndExit}
        >
          保存并退出
        </mdui-button>
        <mdui-button
          slot="action"
          variant="text"
          onClick={handleDirectExit}
          style={{ color: "var(--md-sys-color-error)" }}
        >
          不保存退出
        </mdui-button>
        <mdui-button
          slot="action"
          variant="text"
          onClick={() => setIsConfirmCloseOpen(false)}
        >
          取消
        </mdui-button>
      </mdui-dialog>
      {showSettingsModal && (
        <div className="settings-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="settings-modal-frame" onClick={(e) => e.stopPropagation()}>
            <SettingsApp onClose={() => setShowSettingsModal(false)} />
          </div>
        </div>
      )}
    </main>
  );
}
