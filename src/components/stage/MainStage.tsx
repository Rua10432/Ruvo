import { useEffect, useMemo, useRef, useState } from "react";
import { snackbar } from "mdui";
import { FileText } from "lucide-react";
import type { FileNote, LocalNote, RenamedNote, RequestedHeading, RequestedNote, StageStatus } from "../../types";
import TabBar from "./TabBar";
import StageMoreMenu from "./StageMoreMenu";
import StageToolbar, { defaultActiveFormats, type FormatAction } from "./StageToolbar";
import NotebookLMEditor, { type FormatState, type NotebookLMEditorHandle } from "./NotebookLMEditor";
import { useRuvoSettings } from "../settings/settingsStore";
import { computeWordCount } from "../../utils/wordCount";
import { useNoteTabs } from "../../hooks/useNoteTabs";
import { fileStore, fileStoreError } from "../../services/fileStore";
import { exportNoteToDocx } from "../../utils/docxExport";
import { exportNoteToPdf } from "../../utils/pdfExport";
import "./MainStage.css";

export type MainStageProps = {
  requestedNote?: RequestedNote | null; requestedHeading?: RequestedHeading | null;
  fileNotes?: FileNote[]; renamedNote?: RenamedNote | null; rightOpen?: boolean;
  onActiveNoteChange?: (noteId: string | null) => void;
  onNotesChange?: (notes: LocalNote[], activeId: string | null) => void;
  onStatusChange?: (status: StageStatus) => void;
  onReadNote?: (note: FileNote) => Promise<string>;
  onWriteNote?: (note: LocalNote, content: string) => Promise<void>;
  onActiveHeadingChange?: (text: string, index: number) => void;
  onToggleRight?: () => void;
  onCreateNote?: () => void;
  onCloseNoteTab?: (noteId: string) => void;
  closeTabRequestedId?: string | null;
  onSelectNote?: (note: FileNote) => void;
  onCreateNoteWithName?: (name?: string) => void;
  onRegisterSaveActive?: (saveFn: () => Promise<boolean>) => void;
  toggleLeftShortcut?: string;
  toggleRightShortcut?: string;
  onOpenSettings?: () => void;
};

export default function MainStage({
  requestedNote, requestedHeading, onActiveNoteChange, onNotesChange, onStatusChange,
  fileNotes, renamedNote, onReadNote, onWriteNote, onActiveHeadingChange, rightOpen, onToggleRight,
  onCreateNote, onCloseNoteTab, closeTabRequestedId, onSelectNote, onCreateNoteWithName,
  onRegisterSaveActive, toggleLeftShortcut: propToggleLeftShortcut,
  toggleRightShortcut: propToggleRightShortcut, onOpenSettings,
}: MainStageProps) {
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [formatState, setFormatState] = useState<FormatState>({ hasSelection: false, activeFormats: defaultActiveFormats });
  const editorRef = useRef<NotebookLMEditorHandle>(null);
  const savingNoteIdsRef = useRef<Set<string>>(new Set());
  const onWriteNoteRef = useRef(onWriteNote); onWriteNoteRef.current = onWriteNote;
  const saveActiveRef = useRef<(silent?: boolean, targetNote?: LocalNote) => Promise<boolean>>(() => Promise.resolve(false));
  const { settings } = useRuvoSettings();

  const {
    notesRef, tabs, activeTabId, setActiveTabId, activeTabIdRef, activeNote,
    isDirty, closeTab, closeOtherTabs, copyNoteName, updateNoteContent, markNoteSaved,
  } = useNoteTabs({
    fileNotes, renamedNote, requestedNote, onReadNote,
    onSaveNote: (note) => saveActiveRef.current(true, note),
    onNotice: setNotice, onActiveNoteChange, onNotesChange, onCloseNoteTab,
  });

  const wordCount = useMemo(() => computeWordCount(activeNote?.content), [activeNote?.content]);

  const saveActive = async (silent = false, targetNote?: LocalNote): Promise<boolean> => {
    editorRef.current?.flush();
    const note = targetNote ?? notesRef.current.find((n) => n.id === activeTabIdRef.current) ?? null;
    if (!note?.path || (note.savedContent !== undefined && note.content === note.savedContent) || savingNoteIdsRef.current.has(note.id)) {
      return Boolean(note?.path && note.savedContent !== undefined && note.content === note.savedContent);
    }
    savingNoteIdsRef.current.add(note.id);
    const isTargetActive = note.id === activeTabIdRef.current;
    if (isTargetActive) setSaveState("saving");

    try {
      try {
        await onWriteNoteRef.current?.(note, note.content);
      } catch (err) {
        console.warn("Save failed on first attempt, retrying once...", err);
        await new Promise((r) => setTimeout(r, 300));
        await onWriteNoteRef.current?.(note, note.content);
      }
      markNoteSaved(note.id, note.content);
      if (isTargetActive) setSaveState("saved");
      setNotice(silent ? "已自动保存" : "本地已同步");
      if (!silent) snackbar({ message: "已保存到本地文件" });
      return true;
    } catch (err) {
      console.error("Auto-save failed after retry:", err);
      if (isTargetActive) setSaveState("unsaved");
      setNotice("保存失败");
      snackbar({ message: silent ? "自动保存失败，请检查文件写入权限" : "保存失败" });
      return false;
    } finally {
      savingNoteIdsRef.current.delete(note.id);
    }
  };
  saveActiveRef.current = saveActive;

  useEffect(() => {
    onRegisterSaveActive?.(() => saveActiveRef.current(false));
  }, [onRegisterSaveActive]);

  useEffect(() => {
    if (!settings.autoSave || !isDirty || !activeNote || activeNote.savedContent === undefined) return;
    const timer = window.setTimeout(() => void saveActive(true), settings.autoSaveInterval || 1000);
    return () => window.clearTimeout(timer);
  }, [activeNote?.id, activeNote?.content, isDirty, settings.autoSave, settings.autoSaveInterval]);

  useEffect(() => {
    if (!activeNote) setSaveState("saved");
    else if (savingNoteIdsRef.current.has(activeNote.id)) setSaveState("saving");
    else setSaveState(isDirty ? "unsaved" : "saved");
  }, [activeNote?.id, activeNote?.content, activeNote?.savedContent, isDirty]);

  const prevActiveTabIdRef = useRef<string | null>(activeTabId);
  useEffect(() => {
    setFormatState({ hasSelection: false, activeFormats: defaultActiveFormats });
    const prevId = prevActiveTabIdRef.current;
    prevActiveTabIdRef.current = activeTabId;
    if (prevId && prevId !== activeTabId) {
      const prev = notesRef.current.find((n) => n.id === prevId);
      if (prev?.savedContent !== undefined && prev.content !== prev.savedContent && !savingNoteIdsRef.current.has(prev.id)) {
        void saveActive(true, prev);
      }
    }
  }, [activeTabId]);

  useEffect(() => {
    onStatusChange?.({ noteName: activeNote?.name ?? null, notePath: activeNote?.path ?? null, wordCount, isDirty, message: notice, saveState });
  }, [activeNote?.name, activeNote?.path, wordCount, isDirty, notice, saveState, onStatusChange]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      const dirty = notesRef.current.filter((n) => n.path && n.savedContent !== undefined && n.content !== n.savedContent);
      if (!dirty.length) return;
      dirty.forEach((n) => onWriteNoteRef.current?.(n, n.content));
      e.preventDefault();
      return (e.returnValue = "");
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  useEffect(() => {
    if (closeTabRequestedId) {
      void closeTab(closeTabRequestedId, true);
      onCloseNoteTab?.(closeTabRequestedId);
    }
  }, [closeTabRequestedId, closeTab, onCloseNoteTab]);

  const handleSelectTab = (id: string) => { if (id !== activeTabId) { editorRef.current?.flush(); setActiveTabId(id); } };
  const handleFormat = (action: FormatAction) => { if (activeNote) { editorRef.current?.flush(); editorRef.current?.format(action); } };

  const handleOpenStickyNote = async () => {
    if (!activeNote) return;
    editorRef.current?.flush();
    if (activeNote.content !== activeNote.savedContent) {
      await saveActive(true, activeNote);
    }
    const noteIdToClose = activeNote.id;
    const notePath = activeNote.path || activeNote.id;
    const noteTitle = activeNote.name;

    // Immediately close tab locally and notify parent
    await closeTab(noteIdToClose, true);
    if (notePath && notePath !== noteIdToClose) {
      await closeTab(notePath, true);
    }
    onCloseNoteTab?.(noteIdToClose);
    if (notePath && notePath !== noteIdToClose) {
      onCloseNoteTab?.(notePath);
    }

    try {
      await fileStore.openStickyNoteWindow(notePath, noteTitle);
    } catch (e) {
      console.error("打开便签窗口失败:", e);
      snackbar({ message: `打开便签失败: ${fileStoreError(e)}` });
    }
  };

  const handleExportDocx = async () => {
    if (!activeNote) return;
    await saveActive();
    const currentNote = notesRef.current.find((n) => n.id === activeTabIdRef.current) ?? activeNote;
    const noteName = currentNote.name || (currentNote as any).label || "note";
    try {
      await exportNoteToDocx(noteName, currentNote.content, currentNote.path);
    } catch (err) {
      console.error("导出 Word 失败:", err);
      snackbar({ message: `导出 Word 失败: ${fileStoreError(err)}` });
    }
  };

  const handleExportPdf = async () => {
    if (!activeNote) return;
    await saveActive();
    const currentNote = notesRef.current.find((n) => n.id === activeTabIdRef.current) ?? activeNote;
    const noteName = currentNote.name || (currentNote as any).label || "note";
    try {
      await exportNoteToPdf(noteName, currentNote.content, currentNote.path);
    } catch (err) {
      console.error("导出 PDF 失败:", err);
      snackbar({ message: `导出 PDF 失败: ${fileStoreError(err)}` });
    }
  };

  const handleCreateNewNote = () => {
    if (onCreateNote) {
      onCreateNote();
    } else if (onCreateNoteWithName) {
      onCreateNoteWithName();
    }
  };

  const newNoteShortcut = settings.shortcuts?.newNote || "Ctrl+N";
  const toggleLeftShortcut = propToggleLeftShortcut || settings.shortcuts?.toggleLeftSidebar || "Ctrl+B";
  const toggleRightShortcut = propToggleRightShortcut || settings.shortcuts?.toggleRightSidebar || "Ctrl+J";

  return (
    <section className="main-stage" aria-label="笔记编辑区">
      <div className="stage-topbar">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={(id) => void closeTab(id)}
          onCreateTab={onCreateNote}
        />
        <StageMoreMenu
          activeNote={activeNote}
          tabsCount={tabs.length}
          onCopyName={() => void copyNoteName()}
          onCloseOtherTabs={() => void closeOtherTabs()}
          onOpenStickyNote={handleOpenStickyNote}
          onExportDocx={() => void handleExportDocx()}
          onExportPdf={() => void handleExportPdf()}
        />
      </div>
      <StageToolbar
        activeNote={activeNote} wordCount={wordCount} isDirty={isDirty} onSave={() => void saveActive()}
        onFormat={handleFormat} hasSelection={formatState.hasSelection} activeFormats={formatState.activeFormats}
        rightOpen={rightOpen} onToggleRight={onToggleRight}
      />
      <div className="stage-scroll-area notebooklm-scroll-area">
        {activeNote ? (
          <NotebookLMEditor
            ref={editorRef} activeNote={activeNote}
            onChange={(c) => { updateNoteContent(c); setSaveState("unsaved"); }}
            onSave={() => void saveActive()} requestedHeading={requestedHeading?.label ?? null}
            onActiveHeadingChange={onActiveHeadingChange} onFormatStateChange={setFormatState}
            fileNotes={fileNotes}
            onSelectNote={onSelectNote}
            onCreateNote={onCreateNoteWithName || onCreateNote}
          />
        ) : (
          <div className="stage-empty-workspace">
            <div className="stage-empty-center">
              <div className="stage-empty-watermark">
                <FileText size={48} strokeWidth={1.5} />
              </div>
              <h3 className="stage-empty-title">Ruvo 笔记本</h3>
              <p className="stage-empty-desc">打开或创建笔记以开始写作</p>

              <div className="stage-shortcut-list">
                <button
                  type="button"
                  className="stage-shortcut-row"
                  onClick={handleCreateNewNote}
                >
                  <span className="stage-shortcut-label">新建笔记</span>
                  <span className="stage-shortcut-keys">
                    <kbd>{newNoteShortcut || "Ctrl+N"}</kbd>
                  </span>
                </button>

                <div className="stage-shortcut-row static">
                  <span className="stage-shortcut-label">展开 / 收起侧边栏</span>
                  <span className="stage-shortcut-keys">
                    <kbd>{toggleLeftShortcut || "Ctrl+B"}</kbd>
                  </span>
                </div>

                <div className="stage-shortcut-row static">
                  <span className="stage-shortcut-label">展开 / 收起大纲结构</span>
                  <span className="stage-shortcut-keys">
                    <kbd>{toggleRightShortcut || "Ctrl+J"}</kbd>
                  </span>
                </div>

                {onOpenSettings && (
                  <button
                    type="button"
                    className="stage-shortcut-row"
                    onClick={onOpenSettings}
                  >
                    <span className="stage-shortcut-label">首选项设置</span>
                    <span className="stage-shortcut-keys">
                      <kbd>{settings.shortcuts?.openSettings || "Ctrl+,"}</kbd>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
