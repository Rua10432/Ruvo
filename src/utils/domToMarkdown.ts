/**
 * Converts rich HTML DOM elements from contentEditable editor
 * into clean, standard GitHub Flavored Markdown (GFM).
 */

function wrapInline(text: string, marker: string): string {
  if (!text) return "";
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return `${marker}${text}${marker}`;
  const [, leading, body, trailing] = match;
  if (!body) return text;
  return `${leading}${marker}${body}${marker}${trailing}`;
}

export function domToMarkdown(element: HTMLElement): string {
  function serialize(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Process child nodes recursively
    const children = Array.from(el.childNodes).map(serialize).join("");

    switch (tag) {
      case "h1":
        return `\n\n# ${children.trim()}\n\n`;
      case "h2":
        return `\n\n## ${children.trim()}\n\n`;
      case "h3":
        return `\n\n### ${children.trim()}\n\n`;
      case "h4":
        return `\n\n#### ${children.trim()}\n\n`;
      case "h5":
        return `\n\n##### ${children.trim()}\n\n`;
      case "h6":
        return `\n\n###### ${children.trim()}\n\n`;
      case "strong":
      case "b":
        return wrapInline(children, "**");
      case "em":
      case "i":
        return wrapInline(children, "*");
      case "del":
      case "s":
      case "strike":
        return wrapInline(children, "~~");
      case "code": {
        if (el.parentElement?.tagName.toLowerCase() === "pre") {
          return children;
        }
        const inlineCode = children.replace(/\u200B/g, "").trim();
        return inlineCode ? `\`${inlineCode}\`` : "";
      }
      case "pre": {
        const codeEl = el.querySelector("code");
        const lang = codeEl?.className?.match(/language-([a-z0-9_-]+)/i)?.[1] || "";
        const codeText = (codeEl ? codeEl.textContent : el.textContent) || "";
        const cleanCode = codeText.replace(/\u200B/g, "").replace(/^\n+|\n+$/g, "");
        return `\n\n\`\`\`${lang}\n${cleanCode}\n\`\`\`\n\n`;
      }
      case "blockquote":
        return `\n\n> ${children.trim().replace(/\n+/g, "\n> ")}\n\n`;
      case "ul":
        return `\n\n${children.trim()}\n\n`;
      case "ol":
        return `\n\n${children.trim()}\n\n`;
      case "input":
        return "";
      case "li": {
        const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        if (checkbox && checkbox.closest("li") === el) {
          const isChecked = checkbox.checked || checkbox.hasAttribute("checked");
          const mark = isChecked ? "[x]" : "[ ]";
          let cleanChildren = children.trim().replace(/^\[[ xX]\]\s*/, "");
          return cleanChildren ? `- ${mark} ${cleanChildren}\n` : `- ${mark}\n`;
        }

        const parent = el.parentElement;
        if (parent && parent.tagName.toLowerCase() === "ol") {
          const listItems = Array.from(parent.children).filter((c) => c.tagName.toLowerCase() === "li");
          const idx = listItems.indexOf(el);
          const startAttr = parent.getAttribute("start");
          const start = startAttr ? parseInt(startAttr, 10) : 1;
          const num = !isNaN(start) ? start + Math.max(0, idx) : (idx >= 0 ? idx + 1 : 1);
          return `${num}. ${children.trim()}\n`;
        }
        return `- ${children.trim()}\n`;
      }
      case "table": {
        const rows = Array.from(el.querySelectorAll("tr")).filter(
          (row) => row.closest("table") === el
        );
        if (rows.length === 0) return "";

        const tableData: string[][] = [];
        let maxCols = 0;

        for (const row of rows) {
          const cells = Array.from(row.children).filter(
            (c) => c.tagName.toLowerCase() === "th" || c.tagName.toLowerCase() === "td"
          ) as HTMLElement[];

          const rowData = cells.map((cell) => {
            const cellText = Array.from(cell.childNodes)
              .map(serialize)
              .join("")
              .replace(/\|/g, "\\|")
              .replace(/\n+/g, " ")
              .trim();
            return cellText || " ";
          });

          if (rowData.length > maxCols) {
            maxCols = rowData.length;
          }
          tableData.push(rowData);
        }

        if (maxCols === 0) return "";

        const normalizedRows = tableData.map((row) => {
          const padded = [...row];
          while (padded.length < maxCols) {
            padded.push(" ");
          }
          return padded;
        });

        const headerRow = normalizedRows[0];
        const dataRows = normalizedRows.slice(1);
        const separatorRow = new Array(maxCols).fill("---");

        const lines: string[] = [];
        lines.push(`| ${headerRow.join(" | ")} |`);
        lines.push(`| ${separatorRow.join(" | ")} |`);
        for (const dRow of dataRows) {
          lines.push(`| ${dRow.join(" | ")} |`);
        }

        return `\n\n${lines.join("\n")}\n\n`;
      }
      case "thead":
      case "tbody":
      case "tfoot":
        return children;
      case "tr": {
        const cells = Array.from(el.children).filter(
          (c) => c.tagName.toLowerCase() === "th" || c.tagName.toLowerCase() === "td"
        ) as HTMLElement[];
        if (cells.length > 0) {
          const rowData = cells.map((cell) => {
            const txt = Array.from(cell.childNodes)
              .map(serialize)
              .join("")
              .replace(/\|/g, "\\|")
              .replace(/\n+/g, " ")
              .trim();
            return txt || " ";
          });
          return `| ${rowData.join(" | ")} |\n`;
        }
        return children;
      }
      case "th":
      case "td":
        return children.trim().replace(/\|/g, "\\|").replace(/\n+/g, " ");
      case "hr":
        return `\n\n---\n\n`;
      case "br":
        return "\n";
      case "p":
        return children.trim() ? `\n\n${children.trim()}\n\n` : "\n";
      case "div":
        return children.trim() ? `\n${children.trim()}\n` : "\n";
      case "a": {
        if (el.classList.contains("ruvo-wikilink") || el.classList.contains("ruam-wikilink")) {
          const currentText = children.trim();
          const raw = el.getAttribute("data-raw");
          const target = el.getAttribute("data-target") || "";
          const isUntouched = raw && (
            currentText === raw ||
            (raw.startsWith("[[") && raw.endsWith("]]") && currentText === `[[${raw.slice(2, -2).split("|")[1] || raw.slice(2, -2)}]]`)
          );
          if (isUntouched) return raw;
          if (currentText) return currentText;
          return target ? `[[${target}]]` : "";
        }
        const href = el.getAttribute("href") || "";
        return `[${children.trim()}](${href})`;
      }
      case "img": {
        const src = el.getAttribute("data-markdown-src") || el.getAttribute("src") || "";
        const alt = el.getAttribute("alt") || "";
        const title = el.getAttribute("title");
        if (!src) return "";
        if (title) {
          return `\n\n![${alt}](${src} "${title}")\n\n`;
        }
        return `\n\n![${alt}](${src})\n\n`;
      }
      case "figure": {
        const imgEl = el.querySelector("img");
        const captionEl = el.querySelector("figcaption");
        if (!imgEl) {
          return children.trim() ? `\n\n${children.trim()}\n\n` : "";
        }
        const src = imgEl.getAttribute("data-markdown-src") || imgEl.getAttribute("src") || "";
        if (!src) return "";
        const alt = imgEl.getAttribute("alt") || "";
        const title = imgEl.getAttribute("title");
        const imgMd = title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
        const captionText = captionEl ? Array.from(captionEl.childNodes).map(serialize).join("").trim() : "";
        if (captionText) {
          return `\n\n${imgMd}\n${captionText}\n\n`;
        }
        return `\n\n${imgMd}\n\n`;
      }
      case "figcaption":
        return children.trim();
      case "span": {
        if (el.classList.contains("ruvo-wikilink") || el.classList.contains("ruam-wikilink")) {
          const currentText = children.trim();
          const raw = el.getAttribute("data-raw");
          const target = el.getAttribute("data-target") || "";
          const isUntouched = raw && (
            currentText === raw ||
            (raw.startsWith("[[") && raw.endsWith("]]") && currentText === `[[${raw.slice(2, -2).split("|")[1] || raw.slice(2, -2)}]]`)
          );
          if (isUntouched) return raw;
          if (currentText) return currentText;
          return target ? `[[${target}]]` : "";
        }
        let res = children;
        const style = el.getAttribute("style") || "";
        const isItalic = el.style?.fontStyle === "italic" || /font-style\s*:\s*italic/i.test(style);
        const isBold =
          el.style?.fontWeight === "bold" ||
          parseInt(el.style?.fontWeight || "0", 10) >= 600 ||
          /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
        const isStrike =
          el.style?.textDecoration?.includes("line-through") ||
          /text-decoration\s*:\s*.*line-through/i.test(style);

        if (isBold) res = wrapInline(res, "**");
        if (isItalic) res = wrapInline(res, "*");
        if (isStrike) res = wrapInline(res, "~~");
        return res;
      }
      default:
        return children;
    }
  }

  return serialize(element)
    .replace(/\u200B/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
