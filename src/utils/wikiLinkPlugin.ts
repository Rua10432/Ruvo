import type { TokenizerAndRendererExtension } from "marked";
import type { FileNote } from "../types";

export interface WikiLinkToken {
  type: "wikilink";
  raw: string;
  target: string;
  alias: string;
}

export const wikilinkExtension: TokenizerAndRendererExtension = {
  name: "wikilink",
  level: "inline",
  start(src: string) {
    return src.indexOf("[[");
  },
  tokenizer(src: string) {
    const match = /^\[\[([^\]\r\n|]+)(?:\|([^\]\r\n]+))?\]\]/.exec(src);
    if (match) {
      const raw = match[0];
      const target = match[1].trim();
      const alias = (match[2] || match[1]).trim();
      return {
        type: "wikilink",
        raw,
        target,
        alias,
      };
    }
    return undefined;
  },
  renderer(token: any) {
    const target = token.target || "";
    const alias = token.alias || target;
    const raw = token.raw || `[[${alias === target ? target : `${target}|${alias}`}]]`;
    return `<span class="ruvo-wikilink ruam-wikilink" data-target="${target}" data-raw="${raw}" title="Ctrl + 点击跳转至笔记，或悬停预览">[[${alias}]]</span>`;
  },
};

export interface WikiLinkSuggestion {
  id: string;
  title: string;
  path?: string;
  notebookName?: string;
  isCreateNew?: boolean;
}

/**
 * Filter available notes for autocomplete when user types [[
 */
export function filterWikiLinkSuggestions(
  notes: FileNote[],
  query: string,
  currentNoteId?: string | null
): WikiLinkSuggestion[] {
  const cleanQuery = query.trim().toLowerCase();
  const availableNotes = notes.filter((n) => !currentNoteId || n.id !== currentNoteId);

  let matched: WikiLinkSuggestion[] = [];

  if (!cleanQuery) {
    // Return all notes (up to 8)
    matched = availableNotes.slice(0, 8).map((n) => ({
      id: n.id,
      title: n.name.replace(/\.md$/i, ""),
      path: n.path,
      notebookName: n.notebookName,
      isCreateNew: false,
    }));
  } else {
    // Filter matching notes
    matched = availableNotes
      .filter((n) => {
        const title = n.name.replace(/\.md$/i, "").toLowerCase();
        return title.includes(cleanQuery);
      })
      .slice(0, 8)
      .map((n) => ({
        id: n.id,
        title: n.name.replace(/\.md$/i, ""),
        path: n.path,
        notebookName: n.notebookName,
        isCreateNew: false,
      }));
  }

  // If user entered a query that does not exactly match an existing note, offer to create it
  const exactExists = availableNotes.some(
    (n) => n.name.replace(/\.md$/i, "").toLowerCase() === cleanQuery
  );

  if (cleanQuery && !exactExists) {
    matched.push({
      id: `__create_${cleanQuery}`,
      title: query.trim(),
      isCreateNew: true,
    });
  }

  return matched;
}
