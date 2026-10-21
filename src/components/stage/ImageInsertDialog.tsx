import React, { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, UploadCloud, X, Link as LinkIcon } from "lucide-react";

export interface ImageInsertDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (src: string, alt?: string, title?: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageInsertDialog({
  open,
  onClose,
  onInsert,
}: ImageInsertDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"local" | "url">("local");

  // Local image tab state
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localDataUrl, setLocalDataUrl] = useState<string>("");
  const [localAlt, setLocalAlt] = useState<string>("");
  const [localTitle, setLocalTitle] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  // URL tab state
  const [url, setUrl] = useState<string>("");
  const [urlAlt, setUrlAlt] = useState<string>("");
  const [urlTitle, setUrlTitle] = useState<string>("");

  // Reset inputs when opened
  useEffect(() => {
    if (open) {
      setActiveTab("local");
      setLocalFile(null);
      setLocalDataUrl("");
      setLocalAlt("");
      setLocalTitle("");
      setIsDragging(false);
      setUrl("");
      setUrlAlt("");
      setUrlTitle("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  // Handle dialog closed event (esc or backdrop click)
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

  // Sync MDUI tabs component change event
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const handleChange = () => {
      const val = (el as any).value;
      if (val === "local" || val === "url") {
        setActiveTab(val);
      }
    };
    el.addEventListener("change", handleChange);
    return () => {
      el.removeEventListener("change", handleChange);
    };
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setLocalFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        setLocalDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  };

  const handleClearLocal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalFile(null);
    setLocalDataUrl("");
    setLocalAlt("");
    setLocalTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isInsertDisabled = activeTab === "local" ? !localDataUrl : !url.trim();

  const handleInsert = () => {
    if (activeTab === "local") {
      if (!localDataUrl) return;
      const alt = localAlt.trim() || localFile?.name.replace(/\.[^/.]+$/, "") || "image";
      const title = localTitle.trim() || undefined;
      onInsert(localDataUrl, alt, title);
    } else {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;
      const alt = urlAlt.trim() || undefined;
      const title = urlTitle.trim() || undefined;
      onInsert(trimmedUrl, alt, title);
    }
  };

  return (
    <mdui-dialog
      ref={dialogRef as any}
      open={open ? true : undefined}
      close-on-overlay-click
      close-on-esc
      headline="插入图片"
      className="image-insert-dialog"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      <mdui-tabs ref={tabsRef as any} value={activeTab}>
        <mdui-tab value="local" onClick={() => setActiveTab("local")}>
          <UploadCloud size={16} slot="icon" />
          本地图片
        </mdui-tab>
        <mdui-tab value="url" onClick={() => setActiveTab("url")}>
          <LinkIcon size={16} slot="icon" />
          网络图片
        </mdui-tab>

        <mdui-tab-panel slot="panel" value="local">
          <div className="image-dialog-body" style={{ marginTop: 16 }}>
            {!localDataUrl ? (
              <div
                className={`image-dropzone ${isDragging ? "is-dragging drag-over" : ""}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="image-dropzone-icon" />
                <div className="image-dropzone-title">拖拽图片到此处，或点击选择</div>
                <div className="image-dropzone-hint">支持 PNG, JPG, GIF, WebP, SVG 等常见格式</div>
                <mdui-button
                  variant="outlined"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  选择图片
                </mdui-button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="image-preview-thumbnail">
                  <img
                    src={localDataUrl}
                    alt={localFile?.name || "预览"}
                    className="image-preview-thumb"
                  />
                  <div className="image-preview-info">
                    <span className="image-preview-name" title={localFile?.name}>
                      {localFile?.name}
                    </span>
                    <span className="image-preview-size">
                      {localFile ? formatFileSize(localFile.size) : ""}
                    </span>
                  </div>
                  <mdui-button-icon
                    className="image-preview-remove"
                    title="移除图片"
                    aria-label="移除图片"
                    onClick={handleClearLocal}
                  >
                    <X size={16} />
                  </mdui-button-icon>
                </div>

                <mdui-text-field
                  label="替代文本 (Alt Text, 可选)"
                  variant="outlined"
                  value={localAlt}
                  placeholder={localFile?.name.replace(/\.[^/.]+$/, "") || ""}
                  onInput={(e: React.FormEvent<HTMLElement>) => {
                    const target = e.target as HTMLInputElement;
                    setLocalAlt(target.value ?? "");
                  }}
                />

                <mdui-text-field
                  label="标题提示 (Title, 可选)"
                  variant="outlined"
                  value={localTitle}
                  onInput={(e: React.FormEvent<HTMLElement>) => {
                    const target = e.target as HTMLInputElement;
                    setLocalTitle(target.value ?? "");
                  }}
                />
              </div>
            )}
          </div>
        </mdui-tab-panel>

        <mdui-tab-panel slot="panel" value="url">
          <div className="image-dialog-body" style={{ marginTop: 16 }}>
            <mdui-text-field
              label="图片链接 (URL)"
              variant="outlined"
              value={url}
              placeholder="https://example.com/image.png"
              onInput={(e: React.FormEvent<HTMLElement>) => {
                const target = e.target as HTMLInputElement;
                setUrl(target.value ?? "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) {
                  e.preventDefault();
                  handleInsert();
                }
              }}
            />

            <mdui-text-field
              label="替代文本 (Alt Text)"
              variant="outlined"
              value={urlAlt}
              placeholder="描述图片内容"
              onInput={(e: React.FormEvent<HTMLElement>) => {
                const target = e.target as HTMLInputElement;
                setUrlAlt(target.value ?? "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) {
                  e.preventDefault();
                  handleInsert();
                }
              }}
            />

            <mdui-text-field
              label="标题提示 (Title, 可选)"
              variant="outlined"
              value={urlTitle}
              placeholder="鼠标悬停提示文字"
              onInput={(e: React.FormEvent<HTMLElement>) => {
                const target = e.target as HTMLInputElement;
                setUrlTitle(target.value ?? "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) {
                  e.preventDefault();
                  handleInsert();
                }
              }}
            />

            {url.trim() && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <div style={{ fontSize: "0.8125rem", color: "var(--md-sys-color-on-surface-variant)" }}>
                  图片预览
                </div>
                <div
                  style={{
                    minHeight: 100,
                    maxHeight: 180,
                    overflow: "hidden",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "var(--md-sys-color-surface-container)",
                    borderRadius: 8,
                    border: "1px solid var(--md-sys-color-outline-variant)",
                    padding: 8,
                  }}
                >
                  <img
                    src={url.trim()}
                    alt={urlAlt || "预览"}
                    style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 4 }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                      const errEl = e.currentTarget.parentElement?.querySelector(".url-preview-error") as HTMLElement;
                      if (errEl) errEl.style.display = "block";
                    }}
                    onLoad={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "block";
                      const errEl = e.currentTarget.parentElement?.querySelector(".url-preview-error") as HTMLElement;
                      if (errEl) errEl.style.display = "none";
                    }}
                  />
                  <div
                    className="url-preview-error"
                    style={{
                      display: "none",
                      fontSize: "0.8125rem",
                      color: "var(--md-sys-color-error)",
                    }}
                  >
                    图片无法加载，请检查链接是否正确
                  </div>
                </div>
              </div>
            )}
          </div>
        </mdui-tab-panel>
      </mdui-tabs>

      <mdui-button slot="action" variant="text" onClick={onClose}>
        取消
      </mdui-button>
      <mdui-button
        slot="action"
        variant="filled"
        disabled={isInsertDisabled ? true : undefined}
        onClick={handleInsert}
      >
        插入图片
      </mdui-button>
    </mdui-dialog>
  );
}
