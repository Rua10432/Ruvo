import React, { useCallback, useEffect, useRef, useState } from "react";
import { confirm, prompt, snackbar } from "mdui";
import { Download, Edit2, FileText, Info, StickyNote, Trash2 } from "lucide-react";
import type { TreeItem } from "../../types";
import NoteListItem from "./NoteListItem";
import NoteInfoDialog from "./NoteInfoDialog";
import { fileStore, fileStoreError } from "../../services/fileStore";
import { exportNoteToDocx } from "../../utils/docxExport";
import { exportNoteToPdf } from "../../utils/pdfExport";

const INITIAL_CHUNK_SIZE = 50;
const LOAD_MORE_CHUNK_SIZE = 50;

type NoteListProps = {
  notes: TreeItem[];
  allNotesCount: number;
  selectedNoteId?: string | null;
  onSelectNote?: (note: TreeItem) => void;
  onRenameNote?: (note: TreeItem, newName: string) => Promise<void> | void;
  onDeleteNote?: (note: TreeItem) => Promise<void> | void;
  onOpenStickyNote?: (note: TreeItem) => void;
  getLatestNoteContent?: (note: TreeItem) => Promise<string>;
  highlightQuery?: string;
};

export default function NoteList({
  notes,
  allNotesCount,
  selectedNoteId,
  onSelectNote,
  onRenameNote,
  onDeleteNote,
  onOpenStickyNote,
  getLatestNoteContent,
  highlightQuery,
}: NoteListProps) {
  const [renderCount, setRenderCount] = useState(INITIAL_CHUNK_SIZE);
  const containerRef = useRef<HTMLElement>(null);

  // Singleton menu & dialog state
  const dropdownRef = useRef<any>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuNote, setMenuNote] = useState<TreeItem | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [infoNote, setInfoNote] = useState<TreeItem | null>(null);

  // When notes change or selection changes, ensure the selected note is within the rendered chunk
  useEffect(() => {
    if (selectedNoteId) {
      const selectedIndex = notes.findIndex((n) => n.id === selectedNoteId);
      if (selectedIndex >= INITIAL_CHUNK_SIZE) {
        setRenderCount(Math.min(notes.length, Math.ceil((selectedIndex + 10) / LOAD_MORE_CHUNK_SIZE) * LOAD_MORE_CHUNK_SIZE));
        return;
      }
    }
    setRenderCount(INITIAL_CHUNK_SIZE);
  }, [notes, selectedNoteId]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      setRenderCount((prev) => {
        if (prev < notes.length) {
          return Math.min(notes.length, prev + LOAD_MORE_CHUNK_SIZE);
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const handleClosed = () => {
      setMenuAnchor(null);
    };
    el.addEventListener("closed", handleClosed);
    return () => {
      el.removeEventListener("closed", handleClosed);
    };
  }, [menuAnchor]);

  const handleOpenMenu = useCallback((note: TreeItem, targetEl: HTMLElement) => {
    const rect = targetEl.getBoundingClientRect();
    setMenuNote(note);
    setMenuAnchor({ x: rect.right, y: rect.bottom });
    requestAnimationFrame(() => {
      if (dropdownRef.current) {
        dropdownRef.current.open = true;
      }
    });
  }, []);

  const handleContextMenu = useCallback((note: TreeItem, event: React.MouseEvent) => {
    event.preventDefault();
    setMenuNote(note);
    setMenuAnchor({ x: event.clientX, y: event.clientY });
    requestAnimationFrame(() => {
      if (dropdownRef.current) {
        dropdownRef.current.open = true;
      }
    });
  }, []);

  const closeDropdown = () => {
    if (dropdownRef.current) {
      dropdownRef.current.open = false;
    }
  };

  const handleRename = async () => {
    if (!menuNote) return;
    const target = menuNote;
    closeDropdown();
    const currentBase = target.label.replace(/\.md$/i, "");
    try {
      const newName = await prompt({
        headline: "重命名笔记",
        confirmText: "确定",
        cancelText: "取消",
        textFieldOptions: {
          variant: "outlined",
          label: "笔记名称",
          value: currentBase,
        },
      });
      if (!newName?.trim() || newName.trim() === currentBase) return;
      await onRenameNote?.(target, newName.trim());
    } catch {
      // User cancelled prompt
    }
  };

  const handleDelete = async () => {
    if (!menuNote) return;
    const target = menuNote;
    closeDropdown();
    try {
      await confirm({
        headline: "移至系统回收站",
        description: `确定将笔记“${target.label}”移入系统回收站吗？您随时可以从操作系统回收站中还原。`,
        confirmText: "移入回收站",
        cancelText: "取消",
      });
      await onDeleteNote?.(target);
    } catch {
      // User cancelled confirm
    }
  };

  const handleExportDocx = async () => {
    if (!menuNote?.path) {
      closeDropdown();
      snackbar({ message: "未找到笔记文件路径", placement: "top" });
      return;
    }
    const target = menuNote;
    closeDropdown();
    try {
      const content = getLatestNoteContent
        ? await getLatestNoteContent(target)
        : await fileStore.readNote(target.path!);
      const noteName = (target as any).name || target.label;
      await exportNoteToDocx(noteName, content, target.path);
    } catch (err) {
      snackbar({ message: `导出 DOCX 失败: ${fileStoreError(err)}`, placement: "top" });
    }
  };

  const handleExportPdf = async () => {
    if (!menuNote?.path) {
      closeDropdown();
      snackbar({ message: "未找到笔记文件路径", placement: "top" });
      return;
    }
    const target = menuNote;
    closeDropdown();
    try {
      const content = getLatestNoteContent
        ? await getLatestNoteContent(target)
        : await fileStore.readNote(target.path!);
      const noteName = (target as any).name || target.label;
      await exportNoteToPdf(noteName, content, target.path);
    } catch (err) {
      snackbar({ message: `导出 PDF 失败: ${fileStoreError(err)}`, placement: "top" });
    }
  };

  const handleOpenStickyNote = async () => {
    if (!menuNote?.path) {
      closeDropdown();
      snackbar({ message: "未找到笔记文件路径", placement: "top" });
      return;
    }
    const target = menuNote;
    closeDropdown();
    if (onOpenStickyNote) {
      onOpenStickyNote(target);
      return;
    }
    try {
      const noteName = (target as any).name || target.label;
      await fileStore.openStickyNoteWindow(target.path!, noteName);
    } catch (err) {
      snackbar({ message: `打开便签失败: ${fileStoreError(err)}`, placement: "top" });
    }
  };

  const handleShowInfo = () => {
    if (menuNote) {
      setInfoNote(menuNote);
      setIsInfoDialogOpen(true);
    }
    closeDropdown();
  };

  const visibleNotes = notes.slice(0, renderCount);

  return (
    <nav
      ref={containerRef}
      className="tree-container"
      aria-label="本地 Markdown 笔记列表"
      onScroll={handleScroll}
    >
      <mdui-list className="tree-list">
        {notes.length > 0 ? (
          visibleNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isSelected={selectedNoteId === note.id}
              onSelect={onSelectNote || (() => {})}
              onOpenMenu={handleOpenMenu}
              onContextMenu={handleContextMenu}
              highlightQuery={highlightQuery}
            />
          ))
        ) : (
          <p className="tree-empty">{allNotesCount > 0 ? "未找到匹配笔记" : "暂无笔记"}</p>
        )}
      </mdui-list>

      {/* Singleton context menu dropdown */}
      {menuAnchor && (
        <div
          className="note-context-menu-anchor"
          style={{
            position: "fixed",
            left: `${menuAnchor.x}px`,
            top: `${menuAnchor.y}px`,
            width: 0,
            height: 0,
            zIndex: 1000,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <mdui-dropdown
            ref={dropdownRef}
            placement="bottom-end"
          >
            <div slot="trigger" style={{ width: 0, height: 0 }} />
            <mdui-menu className="tree-item-menu" dense style={{ pointerEvents: "auto" }}>
              <mdui-menu-item onClick={() => void handleOpenStickyNote()}>
                <StickyNote size={15} slot="icon" />
                以便签查看
              </mdui-menu-item>
              <mdui-menu-item onClick={() => void handleRename()}>
                <Edit2 size={15} slot="icon" />
                重命名
              </mdui-menu-item>
              <mdui-menu-item onClick={handleShowInfo}>
                <Info size={15} slot="icon" />
                笔记信息
              </mdui-menu-item>
              <mdui-divider />
              <mdui-menu-item onClick={() => void handleExportDocx()}>
                <FileText size={15} slot="icon" />
                导出为 DOCX
              </mdui-menu-item>
              <mdui-menu-item onClick={() => void handleExportPdf()}>
                <Download size={15} slot="icon" />
                导出为 PDF
              </mdui-menu-item>
              <mdui-divider />
              <mdui-menu-item
                onClick={() => void handleDelete()}
                className="menu-item-danger"
              >
                <Trash2 size={15} slot="icon" />
                删除
              </mdui-menu-item>
            </mdui-menu>
          </mdui-dropdown>
        </div>
      )}

      {/* Singleton info dialog */}
      <NoteInfoDialog
        open={isInfoDialogOpen}
        notePath={infoNote?.path || null}
        noteTitle={infoNote?.label.replace(/\.md$/i, "") || ""}
        onClose={() => setIsInfoDialogOpen(false)}
      />
    </nav>
  );
}
