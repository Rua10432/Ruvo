import { useDeferredValue, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { wikilinkExtension } from "../../utils/wikiLinkPlugin";

type MarkdownPreviewProps = {
  content: string;
  onDoubleClick?: () => void;
};

// Configure DOMPurify to safely allow data: and asset: protocols for images, tables, and task lists
const DOMPURIFY_CONFIG = {
  ADD_TAGS: ["img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "input", "span", "a"],
  ADD_ATTR: ["loading", "type", "checked", "disabled", "data-target", "data-raw", "class", "role", "tabindex"],
  ADD_DATA_URI_TAGS: ["img"],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

// Configure marked with GFM (Typora standard) and WikiLink
marked.use({
  gfm: true,
  breaks: true,
  extensions: [wikilinkExtension],
  renderer: {
    code({ text, lang }) {
      const language = (lang || "").trim() || "plaintext";
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<div class="typora-code-block"><div class="typora-code-header"><span class="typora-code-lang">${language}</span></div><pre><code class="language-${language}">${escaped}</code></pre></div>\n`;
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${href}" alt="${text || ""}"${titleAttr} loading="lazy" />`;
    },
    list(token) {
      const ordered = token.ordered;
      const start = token.start;
      let body = "";
      for (const item of token.items) {
        body += this.listitem(item);
      }
      const isTaskList = token.items.some((i) => i.task);
      const tag = ordered ? "ol" : "ul";
      const startAttr = ordered && start && start !== 1 ? ` start="${start}"` : "";
      const classAttr = isTaskList ? ' class="task-list"' : "";
      return `<${tag}${classAttr}${startAttr}>\n${body}</${tag}>\n`;
    },
    listitem(item) {
      if (item.task) {
        const checkedAttr = item.checked ? ' checked=""' : "";
        const inlineHtml = this.parser.parseInline(item.tokens);
        return `<li class="task-list-item"><input type="checkbox"${checkedAttr} disabled="" /> ${inlineHtml}</li>\n`;
      }
      return `<li>${this.parser.parseInline(item.tokens)}</li>\n`;
    },
  },
});

export default function MarkdownPreview({ content, onDoubleClick }: MarkdownPreviewProps) {
  const deferredContent = useDeferredValue(content);
  const renderedHtml = useMemo(() => {
    const trimmed = deferredContent.trim();
    if (!trimmed) {
      return '<div class="markdown-empty-hint">暂无内容，点击上方【编辑模式】开始撰写笔记</div>';
    }

    // Pre-process headings lacking spaces like `##标题` -> `## 标题`
    const normalized = deferredContent.replace(/^(#{1,6})([^\s#])/gm, (_match, p1, p2) => `${p1} ${p2}`);

    try {
      const raw = marked.parse(normalized, { async: false }) as string;
      return DOMPurify.sanitize(raw, DOMPURIFY_CONFIG) as string;
    } catch (err) {
      console.error("Markdown parse error:", err);
      return `<pre>${DOMPurify.sanitize(deferredContent, DOMPURIFY_CONFIG) as string}</pre>`;
    }
  }, [deferredContent]);

  return (
    <article
      className="markdown-preview typora-markdown"
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? "双击进入编辑模式" : undefined}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
