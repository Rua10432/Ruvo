import type { StageStatus } from "../../types";
import { useRuvoSettings } from "../settings/settingsStore";

type StatusBarProps = {
  status: StageStatus;
  fallbackPath?: string;
};

function formatDisplayPath(rawPath: string): string {
  if (!rawPath || rawPath === "未选择笔记") {
    return rawPath || "未选择笔记";
  }

  // Strip Windows extended-length prefix \\?\ or \\.\ if present
  let clean = rawPath.replace(/^\\\\\?\\/, "").replace(/^\\\\\.\\/, "");
  // Normalize backslashes to forward slashes
  clean = clean.replace(/\\/g, "/");

  // Check if it contains "notebook/" directory boundary
  const match = clean.match(/(?:^|\/)notebook\/(.+)$/i);
  if (match && match[1]) {
    const rel = match[1];
    const parts = rel.split("/").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" / ");
    }
  }

  // Fallback for full paths: show last 2 segments (e.g. VaultName / NoteName.md)
  const parts = clean.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 2) {
    return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
  } else if (parts.length > 0) {
    return parts.join(" / ");
  }

  return rawPath;
}

export default function StatusBar({ status, fallbackPath }: StatusBarProps) {
  const { settings } = useRuvoSettings();
  const rawPath = status.notePath ?? fallbackPath ?? "未选择笔记";
  const displayLabel = formatDisplayPath(rawPath);

  return (
    <footer className="status-bar" aria-label="状态栏">
      <span className="status-path" title={rawPath} aria-label={`当前笔记路径: ${displayLabel}`}>
        {displayLabel}
      </span>
      <div className="status-items">
        {status.saveState === "saving" ? (
          <span
            className="status-meta status-save-state is-saving"
            role="status"
            aria-live="polite"
            title="正在保存更改"
          >
            ⟳ 自动保存中...
          </span>
        ) : status.isDirty || status.saveState === "unsaved" ? (
          <span
            className="status-meta status-save-state is-unsaved"
            role="status"
            aria-live="polite"
            title="存在未保存的内容"
          >
            ● 未保存
          </span>
        ) : (
          <span
            className="status-meta status-save-state is-saved"
            role="status"
            aria-live="polite"
            title={settings.autoSave ? "所有更改已自动保存" : "所有更改已保存"}
          >
            <span className="status-save-icon" aria-hidden="true">✓</span>
            <span className="status-save-text">{settings.autoSave ? "已自动保存" : "已保存"}</span>
          </span>
        )}
        {settings.showWordCount && (
          <span
            className="status-meta"
            title={`总字数: ${status.wordCount} 字`}
            aria-label={`总字数: ${status.wordCount} 字`}
          >
            {status.wordCount} 字
          </span>
        )}
        <span
          className="status-meta"
          title="文本编码: UTF-8"
          aria-label="文本编码: UTF-8"
        >
          UTF-8
        </span>
      </div>
    </footer>
  );
}
