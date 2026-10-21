/**
 * Computes standard word count for mixed Chinese and English markdown notes.
 * - Each CJK (Chinese/Japanese/Korean) character counts as 1 word.
 * - Each Latin/alphanumeric sequence (English word or number) counts as 1 word.
 * - Markdown syntax markers (headings, bold, code block tags) are excluded.
 */
export function computeWordCount(text: string | null | undefined): number {
  if (!text) return 0;

  // Clean Markdown syntax elements
  const clean = text
    .replace(/```[\s\S]*?```/g, " ") // code fences
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[.*?\]\(.*?\)/g, " ") // image tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // link markdown -> link text
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/^#+\s+/gm, "") // heading symbols
    .replace(/[*_~`>#-]/g, " "); // inline markdown formatting markers

  // 1. Match CJK characters
  const cjkMatches = clean.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // 2. Match English / Latin words
  const nonCjk = clean.replace(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, " ");
  const wordMatches = nonCjk.match(/\b[a-zA-Z0-9_\u00C0-\u024F'-]+\b/g);
  const wordCount = wordMatches ? wordMatches.length : 0;

  return cjkCount + wordCount;
}
