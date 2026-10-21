import { BookOpen, FileText } from "lucide-react";
import type { LocalNote } from "../../types";
import { useRuvoSettings } from "../settings/settingsStore";

type DocumentDetailsProps = {
  activeNote: LocalNote | null;
  wordCount: number;
  isDirty: boolean;
};

export default function DocumentDetails({ activeNote, wordCount, isDirty }: DocumentDetailsProps) {
  const { settings } = useRuvoSettings();

  return (
    <mdui-dropdown placement="bottom-end">
      <mdui-tooltip content="文档信息" slot="trigger" placement="bottom" disabled={!activeNote}>
        <span className={`toolbar-tooltip-target ${!activeNote ? "is-disabled" : ""}`}>
          <mdui-button-icon
            className="toolbar-btn doc-details-btn"
            variant="standard"
            disabled={!activeNote}
            aria-label="打开文档信息"
          >
            <BookOpen size={16} />
          </mdui-button-icon>
        </span>
      </mdui-tooltip>
      {activeNote && (
        <mdui-card variant="elevated" className="doc-details-card">
          <div className="doc-details-header">
            <FileText size={16} />
            <strong>{activeNote.name}</strong>
          </div>
          <mdui-divider />
          {settings.showWordCount && (
            <div className="doc-details-row">
              <span>字数统计</span>
              <mdui-badge>{`${wordCount} 字`}</mdui-badge>
            </div>
          )}
          <div className="doc-details-row">
            <span>保存状态</span>
            <span className={`doc-status-text ${isDirty ? "is-dirty" : ""}`}>
              {isDirty ? "有未保存修改" : "本地已同步"}
            </span>
          </div>
        </mdui-card>
      )}
    </mdui-dropdown>
  );
}
