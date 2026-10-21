import { FileText, Plus } from "lucide-react";
import type { FileNote } from "../../../types";
import "./WikiLink.css";

export interface WikiLinkHoverCardProps {
  open: boolean;
  targetName: string;
  position: { top: number; left: number };
  matchedNote?: FileNote | null;
  targetNote?: FileNote | null;
  excerpt: string;
  onNavigate?: (target: FileNote | string) => void;
  onCreate?: (title: string) => void;
  onSelectNote?: (noteId: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function WikiLinkHoverCard({
  open,
  targetName,
  position,
  matchedNote,
  targetNote: propTargetNote,
  excerpt,
  onNavigate: _onNavigate,
  onCreate,
  onSelectNote,
  onMouseEnter,
  onMouseLeave,
}: WikiLinkHoverCardProps) {
  if (!open) return null;

  const targetNote = propTargetNote || matchedNote;

  return (
    <div
      className="wikilink-hover-card"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="wikilink-hover-header">
        <div className="wikilink-hover-title-group">
          <FileText size={16} color="var(--md-sys-color-primary)" />
          <h4 className="wikilink-hover-title">{targetName}</h4>
        </div>
        <span className="wikilink-suggestion-badge">
          {targetNote ? targetNote.notebookName || "已链接" : "未创建"}
        </span>
      </div>

      <div className="wikilink-hover-excerpt">
        {targetNote ? (
          excerpt.trim() ? (
            excerpt
          ) : (
            <span style={{ fontStyle: "italic", opacity: 0.7 }}>暂无正文内容</span>
          )
        ) : (
          <span style={{ fontStyle: "italic", opacity: 0.85 }}>
            该笔记尚未创建。点击下方按钮可立即创建并链接该笔记。
          </span>
        )}
      </div>

      <div className="wikilink-hover-actions">
        {targetNote ? (
          <mdui-button variant="text" size="small" onClick={() => onSelectNote?.(targetNote.id)}>打开笔记</mdui-button>
        ) : (
          <mdui-button
            variant="tonal"
            onClick={() => onCreate?.(targetName)}
          >
            <Plus size={14} slot="icon" />
            创建此笔记
          </mdui-button>
        )}
      </div>
    </div>
  );
}
