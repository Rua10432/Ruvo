import type { Backlink, LocalNote, OutlineItem } from "../types";

/**
 * 将 Markdown 格式文本剥离为纯文本（去除 #、**、*、~~、`、[]()、HTML 标签等）
 */
export function stripMarkdownToPlainText(text: string): string {
  if (!text) return "";
  let clean = text
    .replace(/<[^>]*>/g, "") // 去除 HTML 标签
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // 去除图片语法，保留 alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // 去除链接语法，保留文本
    .replace(/`([^`]+)`/g, "$1") // 去除行内代码标记
    .replace(/~~(.*?)~~/g, "$1") // 去除删除线
    .replace(/\[\^[^\]]+\]/g, ""); // 去除脚注引用

  // 去除加粗与斜体（如 **text**, *text*, ***text***）
  clean = clean
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // 去除残留的标记字符
    .replace(/[*_~`#]/g, "")
    .trim();

  return clean;
}

export function getOutline(content: string): OutlineItem[] {
  return content.split(/\r?\n/).flatMap((line, index) => {
    // 匹配 1-6 级标题，兼容是否有空格
    const heading = line.match(/^(#{1,6})\s*(.+)$/);
    if (!heading) return [];
    const level = Math.min(Math.max(heading[1].length, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
    const plainText = stripMarkdownToPlainText(heading[2]);
    if (!plainText) return [];
    return [{ id: `${index}-${plainText}`, label: plainText, level }];
  });
}

export function getBacklinks(notes: LocalNote[], activeNote: LocalNote | null): Backlink[] {
  if (!activeNote) return [];
  const title = activeNote.name.replace(/\.md$/i, "").toLocaleLowerCase();
  const idLower = activeNote.id.toLocaleLowerCase();
  const nameLower = activeNote.name.toLocaleLowerCase();
  const targets = new Set([title, nameLower, idLower]);

  return notes.flatMap((note) => {
    if (note.id === activeNote.id || !note.content.includes("[[")) return [];

    // Fast sub-string check: does note content even contain any of the target names?
    const contentLower = note.content.toLowerCase();
    let hasTarget = false;
    for (const target of targets) {
      if (contentLower.includes(target)) {
        hasTarget = true;
        break;
      }
    }
    if (!hasTarget) return [];

    const lines = note.content.split(/\r?\n/);
    const regex = /\[\[([^\]]+)\]\]/g;
    const matchIndex = lines.findIndex((line) => {
      if (!line.includes("[[")) return false;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        if (targets.has(match[1].trim().toLowerCase())) {
          return true;
        }
      }
      return false;
    });

    if (matchIndex < 0) return [];
    const cleanExcerpt = stripMarkdownToPlainText(lines[matchIndex]);
    return [{ id: note.id, title: note.name.replace(/\.md$/i, ""), excerpt: cleanExcerpt, meta: `第 ${matchIndex + 1} 行` }];
  });
}
