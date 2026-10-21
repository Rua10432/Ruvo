import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { fileStore, fileStoreError } from "../../services/fileStore";
import type { NoteMetadata } from "../../types";
import "./NoteInfoDialog.css";

export type NoteInfoDialogProps = {
  open: boolean;
  notePath: string | null;
  noteTitle: string;
  onClose: () => void;
};

function formatFileSize(bytes?: number): string {
  if (typeof bytes !== "number" || isNaN(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(str?: string): string {
  if (!str) return "不可用";
  // Format YYYY-MM-DD into YYYY/MM/DD
  return str.replace(/-/g, "/");
}

export default function NoteInfoDialog({
  open,
  notePath,
  noteTitle,
  onClose,
}: NoteInfoDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [metadata, setMetadata] = useState<NoteMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !notePath) {
      setMetadata(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fileStore
      .getNoteMetadata(notePath)
      .then((data) => {
        if (isMounted) {
          setMetadata(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(fileStoreError(err));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, notePath]);

  // Sync MDUI dialog closed event (ESC or backdrop click)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClosed = () => {
      onClose();
    };
    el.addEventListener("closed", handleClosed);
    return () => {
      el.removeEventListener("closed", handleClosed);
    };
  }, [onClose]);

  return (
    <mdui-dialog
      ref={dialogRef as any}
      open={open ? true : undefined}
      close-on-overlay-click
      close-on-esc
      className="note-info-dialog"
    >
      <div className="note-info-body">
        {loading && (
          <div className="note-info-loading">
            <mdui-circular-progress />
            <span>正在读取属性...</span>
          </div>
        )}

        {error && !loading && (
          <div className="note-info-error">
            <AlertCircle size={22} />
            <div className="note-info-error-msg">{error}</div>
            <mdui-button
              variant="text"
              onClick={() => {
                if (notePath) {
                  setLoading(true);
                  setError(null);
                  fileStore
                    .getNoteMetadata(notePath)
                    .then((data) => {
                      setMetadata(data);
                      setLoading(false);
                    })
                    .catch((err) => {
                      setError(fileStoreError(err));
                      setLoading(false);
                    });
                }
              }}
            >
              重试
            </mdui-button>
          </div>
        )}

        {!loading && !error && metadata && (
          <div className="note-info-content">
            {/* 描述组 */}
            <section className="note-info-section">
              <h3 className="note-info-section-title">描述</h3>
              <div className="note-info-grid">
                <span className="note-info-prop-label">文件名:</span>
                <span className="note-info-prop-value">{metadata.filename}</span>

                <span className="note-info-prop-label">文件大小:</span>
                <span className="note-info-prop-value">{formatFileSize(metadata.fileSizeBytes)}</span>

                <span className="note-info-prop-label">标题:</span>
                <span className="note-info-prop-value">{noteTitle || "不可用"}</span>

                <span className="note-info-prop-label">创建时间:</span>
                <span className="note-info-prop-value">{formatDateTime(metadata.createdAt)}</span>

                <span className="note-info-prop-label">修改时间:</span>
                <span className="note-info-prop-value">{formatDateTime(metadata.modifiedAt)}</span>

                <span className="note-info-prop-label">修改次数:</span>
                <span className="note-info-prop-value">{metadata.editCount} 次</span>

                <span className="note-info-prop-label">上次修改者:</span>
                <span className="note-info-prop-value">{metadata.lastModifiedBy || "不可用"}</span>
              </div>
            </section>

            <div className="note-info-divider" />

            {/* 高级组 */}
            <section className="note-info-section">
              <h3 className="note-info-section-title">高级</h3>
              <div className="note-info-grid">
                <span className="note-info-prop-label">位置:</span>
                <span className="note-info-prop-value is-path" title={notePath || metadata.path}>
                  {notePath || metadata.path}
                </span>

                <span className="note-info-prop-label">格式:</span>
                <span className="note-info-prop-value">Markdown 文档 (.md)</span>

                <span className="note-info-prop-label">编码:</span>
                <span className="note-info-prop-value">UTF-8</span>
              </div>
            </section>
          </div>
        )}
      </div>

      <mdui-button
        variant="filled"
        onClick={onClose}
        slot="action"
        className="note-info-confirm-btn"
      >
        确定
      </mdui-button>
    </mdui-dialog>
  );
}
