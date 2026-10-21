import { FileText, X } from "lucide-react";
import type { LocalNote } from "../../types";

type NoteTabProps = {
  tab: LocalNote;
  isActive: boolean;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
};

export default function NoteTab({ tab, isActive, onSelect, onClose }: NoteTabProps) {
  const isDirty = tab.savedContent !== undefined && tab.content !== tab.savedContent;
  const displayName = tab.name.replace(/\.md$/i, "");

  return (
    <div
      className={`note-tab ${isActive ? "is-active active" : ""} ${isDirty ? "is-dirty" : ""}`}
      title={isDirty ? `${displayName} (未保存)` : displayName}
    >
      <button
        type="button"
        className="note-tab-select"
        role="tab"
        aria-selected={isActive}
        onClick={() => onSelect(tab.id)}
      >
        <FileText size={15} />
        <span>{displayName}</span>
      </button>
      <mdui-button-icon
        className="note-tab-close"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        aria-label={isDirty ? `关闭未保存的 ${displayName}` : `关闭 ${displayName}`}
        title={isDirty ? "未保存更改 (点击关闭)" : `关闭 ${displayName}`}
      >
        {isDirty && <span className="tab-dirty-dot" aria-hidden="true" />}
        <X size={14} className="tab-close-icon" aria-hidden="true" />
      </mdui-button-icon>
    </div>
  );
}
