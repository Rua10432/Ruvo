import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Notebook, TreeItem, NoteSearchResult } from "../../types";
import { fileStore } from "../../services/fileStore";

export type { TreeItem, Notebook as NotebookItem };
import NotebookSwitcher from "./NotebookSwitcher";
import NoteSearch from "./NoteSearch";
import NoteList from "./NoteList";
import "./LeftSidebar.css";

export type LeftSidebarProps = {
  onCollapse?: () => void;
  notes: TreeItem[];
  selectedNoteId?: string | null;
  onSelectNote?: (note: TreeItem) => void;
  onCreateNote?: (note: TreeItem) => void;
  onRenameNote?: (note: TreeItem, newName: string) => Promise<void> | void;
  onDeleteNote?: (note: TreeItem) => Promise<void> | void;
  onOpenStickyNote?: (note: TreeItem) => void;
  getLatestNoteContent?: (note: TreeItem) => Promise<string>;
  notebooks?: Notebook[];
  activeNotebookId?: string | null;
  onSelectNotebook?: (notebook: Notebook) => void;
  onCreateNotebook?: () => void;
  onDeleteNotebook?: (notebook: Notebook) => Promise<void> | void;
};

export default function LeftSidebar({
  onCollapse: _onCollapse,
  notes,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onRenameNote,
  onDeleteNote,
  onOpenStickyNote,
  getLatestNoteContent,
  notebooks = [],
  activeNotebookId,
  onSelectNotebook,
  onCreateNotebook,
  onDeleteNotebook,
}: LeftSidebarProps) {
  const [query, setQuery] = useState("");
  const [contentSearchResults, setContentSearchResults] = useState<NoteSearchResult[]>([]);

  useEffect(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2 || !activeNotebookId) {
      setContentSearchResults([]);
      return;
    }

    const isTauriEnv = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
    if (!isTauriEnv) {
      setContentSearchResults([]);
      return;
    }

    let canceled = false;
    const timer = setTimeout(() => {
      fileStore.searchNotesContent(activeNotebookId, cleanQuery)
        .then((results) => {
          if (!canceled) {
            setContentSearchResults(results || []);
          }
        })
        .catch((err) => {
          if (!canceled) {
            console.error("searchNotesContent error:", err);
            setContentSearchResults([]);
          }
        });
    }, 150);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [query, activeNotebookId]);

  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return notes;

    const snippetMap = new Map<string, { lineNumber: number; snippet: string }>();
    for (const res of contentSearchResults) {
      const p = (res.note_path || (res as any).notePath || "").toLowerCase();
      const n = (res.note_name || (res as any).noteName || "").toLowerCase();
      const snippet = res.snippet || (res as any).line_content || "";
      const lineNum = res.line_number ?? (res as any).lineNumber ?? 1;
      if (p && !snippetMap.has(p)) {
        snippetMap.set(p, { lineNumber: lineNum, snippet });
      }
      if (n && !snippetMap.has(n)) {
        snippetMap.set(n, { lineNumber: lineNum, snippet });
      }
    }

    const matchedList: TreeItem[] = [];

    for (const note of notes) {
      const titleMatched = note.label.toLocaleLowerCase().includes(normalized);
      const notePathKey = (note.path || "").toLowerCase();
      const noteNameKey = note.label.toLowerCase();

      let snippetInfo = snippetMap.get(notePathKey) || snippetMap.get(noteNameKey);

      // Fallback: check in-memory content if available and 2+ characters
      if (!snippetInfo && note.content && normalized.length >= 2) {
        const lines = note.content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.toLowerCase().includes(normalized)) {
            const trimmed = line.trim();
            const snippet = trimmed.length > 100 ? `${trimmed.slice(0, 100)}...` : trimmed;
            snippetInfo = { lineNumber: i + 1, snippet };
            break;
          }
        }
      }

      if (titleMatched || snippetInfo) {
        matchedList.push({
          ...note,
          snippet: snippetInfo?.snippet,
          snippetLine: snippetInfo?.lineNumber,
        });
      }
    }

    return matchedList;
  }, [notes, query, contentSearchResults]);

  const handleCreateNote = () => {
    const stamp = Date.now();
    let suffix = 1;
    let label = "未命名.md";
    while (notes.some((note) => note.label === label)) {
      suffix += 1;
      label = `未命名 (${suffix}).md`;
    }
    const idBase = `note-${stamp}`;
    let id = idBase;
    let idSuffix = 1;
    while (notes.some((note) => note.id === id)) {
      idSuffix += 1;
      id = `${idBase}-${idSuffix}`;
    }
    onCreateNote?.({ id, label, type: "file" });
    setQuery("");
  };


  return (
    <aside className="left-sidebar" aria-label="笔记导航">
      <NotebookSwitcher
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        onSelectNotebook={onSelectNotebook}
        onCreateNotebook={onCreateNotebook}
        onDeleteNotebook={onDeleteNotebook}
      />

      <mdui-button
        variant="filled"
        full-width
        className="new-note-btn"
        onClick={handleCreateNote}
      >
        <Plus size={18} slot="icon" />
        新建笔记
      </mdui-button>

      <div className="sidebar-section-title">
        <span>笔记</span>
      </div>

      <NoteSearch query={query} onQueryChange={setQuery} />

      <NoteList
        notes={filteredNotes}
        allNotesCount={notes.length}
        selectedNoteId={selectedNoteId}
        onSelectNote={onSelectNote}
        onRenameNote={onRenameNote}
        onDeleteNote={onDeleteNote}
        onOpenStickyNote={onOpenStickyNote}
        getLatestNoteContent={getLatestNoteContent}
        highlightQuery={query.trim()}
      />
    </aside>
  );
}
