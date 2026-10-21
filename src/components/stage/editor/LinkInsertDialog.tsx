import React, { useEffect, useState } from "react";

export interface LinkInsertDialogProps {
  open: boolean;
  initialText?: string;
  initialUrl?: string;
  onClose: () => void;
  onInsert: (url: string, text: string) => void;
}

export default function LinkInsertDialog({
  open,
  initialText = "",
  initialUrl = "https://",
  onClose,
  onInsert,
}: LinkInsertDialogProps) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setUrl(initialUrl || "https://");
    }
  }, [open, initialText, initialUrl]);

  const handleSubmit = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || /^javascript:/i.test(trimmedUrl)) {
      onClose();
      return;
    }
    onInsert(trimmedUrl, text.trim() || trimmedUrl);
  };

  return (
    <mdui-dialog
      open={open ? true : undefined}
      close-on-overlay-click
      close-on-esc
      headline="添加超链接"
      className="link-insert-dialog"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
        <mdui-text-field
          variant="outlined"
          label="链接文本"
          value={text}
          onInput={(e: React.FormEvent<HTMLElement>) => {
            const target = e.target as HTMLInputElement;
            setText(target.value ?? "");
          }}
        />
        <mdui-text-field
          variant="outlined"
          label="链接地址 (URL)"
          value={url}
          onInput={(e: React.FormEvent<HTMLElement>) => {
            const target = e.target as HTMLInputElement;
            setUrl(target.value ?? "");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </div>
      <mdui-button slot="action" variant="text" onClick={onClose}>
        取消
      </mdui-button>
      <mdui-button slot="action" variant="filled" onClick={handleSubmit}>
        确认添加
      </mdui-button>
    </mdui-dialog>
  );
}
