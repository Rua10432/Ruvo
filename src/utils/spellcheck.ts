/**
 * Spellcheck utility for Ruvo editor.
 * Uses CSS Custom Highlight API (::highlight(ruam-spell-error)) for non-destructive,
 * high-performance red wavy underlines that work across all WebView2 environments.
 */

// Common English typos and misspellings with 100% confidence
const COMMON_TYPOS = new Set<string>([
  "helllo", "helloo", "writting", "recieve", "recieved", "recieving",
  "seperate", "seperated", "seperately", "definately", "untill",
  "beleive", "beleived", "thier", "wich", "truely", "occured",
  "occuring", "neccessary", "unneccessary", "existance", "fourty",
  "lenght", "strenght", "suprise", "suprised", "succesful",
  "succesfully", "embarass", "embarassed", "calender", "catagory",
  "catagories", "wierd", "relevent", "irrelevent", "mispell",
  "mispelled", "dosen't", "teh", "goverment", "occurance",
  "recommand", "recommanded", "tommorow", "collegue", "collegues",
  "appple", "computr", "progam", "progamer", "langauge", "enviornment",
  "libary", "noticable", "maintainance", "appearence", "peice",
  "acheive", "acheived", "guarentee", "garantee", "pronounciation",
  "priviledge", "rythm", "rhytm", "agressive", "tommorrow"
]);

/**
 * Checks if a word is likely misspelled:
 * 1. Matches common typo list
 * 2. Has 3+ consecutive identical letters (e.g., "helllo", "sooo", "pleeease")
 */
export function isMisspelledWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (COMMON_TYPOS.has(lower)) {
    return true;
  }
  // Check 3+ consecutive identical letters (e.g. "helllo")
  if (/([a-zA-Z])\1{2,}/.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Scans all text nodes in the container and highlights misspelled words
 * using CSS Custom Highlight API without modifying the DOM.
 */
export function highlightSpellingErrors(container: HTMLElement | null): void {
  if (typeof CSS === "undefined" || !("highlights" in CSS) || !container) {
    return;
  }

  const ranges: Range[] = [];
  const wordRegex = /\b[a-zA-Z]{2,}\b/g;

  // Walk text nodes
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        // Skip code blocks, preformatted text, math, or links
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === "code" || tag === "pre" || tag === "script" || tag === "style") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    const text = currentNode.textContent || "";
    let match: RegExpExecArray | null;
    wordRegex.lastIndex = 0;

    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      if (isMisspelledWord(word)) {
        try {
          const range = new Range();
          range.setStart(currentNode, match.index);
          range.setEnd(currentNode, match.index + word.length);
          ranges.push(range);
        } catch {
          // Ignore invalid range boundaries
        }
      }
    }
    currentNode = walker.nextNode();
  }

  try {
    if (ranges.length > 0) {
      // @ts-ignore Highlight constructor is standard in modern WebView2
      const highlight = new Highlight(...ranges);
      // @ts-ignore
      highlight.type = "spelling-error";
      // @ts-ignore
      CSS.highlights.set("ruvo-spell-error", highlight);
      // @ts-ignore
      CSS.highlights.set("ruam-spell-error", highlight);
    } else {
      // @ts-ignore
      CSS.highlights.delete("ruvo-spell-error");
      // @ts-ignore
      CSS.highlights.delete("ruam-spell-error");
    }
  } catch (err) {
    console.warn("Failed to update spelling highlights:", err);
  }
}

/**
 * Clears all custom spelling highlights.
 */
export function clearSpellingHighlights(): void {
  if (typeof CSS !== "undefined" && "highlights" in CSS) {
    try {
      // @ts-ignore
      CSS.highlights.delete("ruvo-spell-error");
      // @ts-ignore
      CSS.highlights.delete("ruam-spell-error");
    } catch {
      // Ignore
    }
  }
}
