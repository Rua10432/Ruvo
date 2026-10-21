import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Columns2, FileCode } from "lucide-react";
import type { FormatAction } from "./StageToolbar";
import MarkdownPreview from "./MarkdownPreview";
import { useRuvoSettings } from "../settings/settingsStore";

export type MarkdownEditorHandle = {
  focus: () => void;
  insertFormat: (action: FormatAction) => void;
};

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(({ value, onChange }, ref) => {
  const { settings } = useRuvoSettings();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [splitPreview, setSplitPreview] = useState(true);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 450)}px`;
  }, [value, splitPreview]);

  const insertFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selected = currentText.substring(start, end);

    let prefix = "";
    let suffix = "";
    let placeholder = "";

    switch (action) {
      case "undo":
        document.execCommand("undo");
        onChange(textarea.value);
        return;
      case "redo":
        document.execCommand("redo");
        onChange(textarea.value);
        return;
      case "heading-1":
        prefix = "\n# ";
        suffix = "\n";
        placeholder = "一级标题";
        break;
      case "heading-2":
        prefix = "\n## ";
        suffix = "\n";
        placeholder = "二级标题";
        break;
      case "heading-3":
        prefix = "\n### ";
        suffix = "\n";
        placeholder = "三级标题";
        break;
      case "heading-4":
        prefix = "\n#### ";
        suffix = "\n";
        placeholder = "四级标题";
        break;
      case "heading-5":
        prefix = "\n##### ";
        suffix = "\n";
        placeholder = "五级标题";
        break;
      case "heading-6":
        prefix = "\n###### ";
        suffix = "\n";
        placeholder = "六级标题";
        break;
      case "bold":
        prefix = "**";
        suffix = "**";
        placeholder = "粗体文本";
        break;
      case "italic":
        prefix = "*";
        suffix = "*";
        placeholder = "斜体文本";
        break;
      case "link":
        prefix = "[";
        suffix = "](https://example.com)";
        placeholder = "链接文字";
        break;
      case "code":
        prefix = "`";
        suffix = "`";
        placeholder = "代码";
        break;
      case "code-block":
        prefix = "\n```javascript\n";
        suffix = "\n```\n";
        placeholder = "// 请输入代码";
        break;
      case "bullet-list":
        prefix = "\n- ";
        suffix = "\n";
        placeholder = "列表项";
        break;
      case "numbered-list":
        prefix = "\n1. ";
        suffix = "\n";
        placeholder = "列表项";
        break;
      case "task-list":
        prefix = "\n- [ ] ";
        suffix = "\n";
        placeholder = "任务待办";
        break;
      case "quote":
        prefix = "\n> ";
        suffix = "\n";
        placeholder = "引用文本";
        break;
      case "hr":
        prefix = "\n\n---\n\n";
        suffix = "";
        placeholder = "";
        break;
      case "strikethrough":
        prefix = "~~";
        suffix = "~~";
        placeholder = "删除线文本";
        break;
    }

    const insertedContent = selected || placeholder;
    const nextValue =
      currentText.substring(0, start) + prefix + insertedContent + suffix + currentText.substring(end);

    onChange(nextValue);

    // Set cursor position inside the formatted block
    window.requestAnimationFrame(() => {
      textarea.focus();
      const newCursorStart = start + prefix.length;
      const newCursorEnd = newCursorStart + insertedContent.length;
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    });
  };

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    insertFormat,
  }));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts 2 spaces
    if (event.key === "Tab") {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = textarea.value;
      const nextValue = currentText.substring(0, start) + "  " + currentText.substring(end);
      onChange(nextValue);
      window.requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
      return;
    }

    // Ctrl+B for bold
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      insertFormat("bold");
      return;
    }

    // Ctrl+I for italic
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      insertFormat("italic");
      return;
    }
  };

  return (
    <div className={`markdown-editor-wrapper ${splitPreview ? "is-split" : ""}`}>
      <div className="editor-view-controls">
        <mdui-segmented-button-group selects="single" value={splitPreview ? "split" : "source"}>
          <mdui-segmented-button
            value="source"
            onClick={() => setSplitPreview(false)}
          >
            <FileCode size={14} slot="icon" />
            源码
          </mdui-segmented-button>
          <mdui-segmented-button
            value="split"
            onClick={() => setSplitPreview(true)}
          >
            <Columns2 size={14} slot="icon" />
            实时预览
          </mdui-segmented-button>
        </mdui-segmented-button-group>
      </div>

      <div className="editor-panes-container">
        <div className="editor-pane source-pane">
          <textarea
            ref={textareaRef}
            className="markdown-editor-textarea"
            aria-label="Markdown 源码编辑"
            placeholder="在此输入 Markdown 内容..."
            spellCheck={settings.spellcheck}
            lang={settings.spellcheck ? "en-US" : "zh-CN"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {splitPreview && (
          <div className="editor-pane preview-pane">
            <MarkdownPreview content={value} />
          </div>
        )}
      </div>
    </div>
  );
});

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
