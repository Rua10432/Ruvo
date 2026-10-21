import React from "react";
import { FileText, MoreVertical } from "lucide-react";
import type { TreeItem } from "../../types";

export type NoteListItemProps = {
  note: TreeItem;
  isSelected: boolean;
  onSelect: (note: TreeItem) => void;
  onOpenMenu?: (note: TreeItem, targetEl: HTMLElement) => void;
  onContextMenu?: (note: TreeItem, event: React.MouseEvent) => void;
  highlightQuery?: string;
};

function highlightMatch(text: string, query?: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQ);
  if (idx === -1) return text;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let currentIdx = lowerText.indexOf(lowerQ, lastIdx);

  while (currentIdx !== -1) {
    if (currentIdx > lastIdx) {
      parts.push(text.slice(lastIdx, currentIdx));
    }
    parts.push(
      <mark key={currentIdx} className="search-highlight">
        {text.slice(currentIdx, currentIdx + q.length)}
      </mark>
    );
    lastIdx = currentIdx + q.length;
    currentIdx = lowerText.indexOf(lowerQ, lastIdx);
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return <>{parts}</>;
}

function NoteListItemInner({
  note,
  isSelected,
  onSelect,
  onOpenMenu,
  onContextMenu,
  highlightQuery,
}: NoteListItemProps) {
  const noteTitle = note.label.replace(/\.md$/i, "");

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(note, e);
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenMenu?.(note, e.currentTarget as HTMLElement);
  };

  return (
    <mdui-list-item
      rounded
      active={isSelected ? true : undefined}
      onClick={() => onSelect(note)}
      onContextMenu={handleContextMenu}
      className={`tree-item ${isSelected ? "is-selected" : ""} ${note.snippet ? "has-snippet" : ""}`}
    >
      <div slot="custom" className="tree-item-content">
        <div className="tree-item-main">
          <div className="tree-item-header">
            <FileText size={16} className="tree-item-icon" />
            <span className="tree-label" title={noteTitle}>
              {highlightMatch(noteTitle, highlightQuery)}
            </span>
          </div>
          {note.snippet && (
            <div className="tree-item-snippet" title={`第 ${note.snippetLine || 1} 行: ${note.snippet}`}>
              {note.snippetLine && <span className="snippet-line">L{note.snippetLine}</span>}
              <span className="snippet-text">
                {highlightMatch(note.snippet, highlightQuery)}
              </span>
            </div>
          )}
        </div>
        <div
          className="tree-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <mdui-button-icon
            variant="standard"
            className="tree-item-more-btn"
            aria-label="更多操作"
            onClick={handleMoreClick}
          >
            <MoreVertical size={16} />
          </mdui-button-icon>
        </div>
      </div>
    </mdui-list-item>
  );
}

const NoteListItem = React.memo(NoteListItemInner);
export default NoteListItem;
