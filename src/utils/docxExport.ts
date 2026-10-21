import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  LevelFormat,
  Packer,
  ImageRun,
  ExternalHyperlink,
  type ParagraphChild,
} from "docx";
import { marked, type Tokens, type Token } from "marked";
import { convertFileSrc } from "@tauri-apps/api/core";
import { snackbar } from "mdui";
import { fileStore } from "../services/fileStore";
import { wikilinkExtension } from "./wikiLinkPlugin";

// Ensure marked uses GFM and wikilink tokenization
marked.use({
  gfm: true,
  breaks: true,
  extensions: [wikilinkExtension],
});

// Provide toUint8Array compatibility for Packer if not present on current docx build
if (typeof (Packer as unknown as { toUint8Array?: unknown }).toUint8Array !== "function") {
  (Packer as unknown as { toUint8Array: (doc: Document) => Promise<Uint8Array> }).toUint8Array = async (
    doc: Document
  ) => {
    const arrayBuffer = await Packer.toArrayBuffer(doc);
    return new Uint8Array(arrayBuffer);
  };
}

/**
 * Chinese-friendly font configuration with PingFang SC, Microsoft YaHei, and Calibri
 */
const CHINESE_FONT_CONFIG = {
  ascii: "Calibri",
  eastAsia: "Microsoft YaHei",
  hAnsi: "Calibri",
  cs: "PingFang SC",
};

const CODE_FONT = "Consolas";

interface InlineFormat {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  underline?: boolean;
}

/**
 * Asynchronously converts a Uint8Array buffer into a base64 string.
 * Uses FileReader.readAsDataURL for non-blocking asynchronous conversion,
 * falling back to chunked processing (32KB chunks) if FileReader is not available or fails.
 */
export async function uint8ArrayToBase64Async(buffer: Uint8Array): Promise<string> {
  if (typeof FileReader !== "undefined" && typeof Blob !== "undefined") {
    try {
      return await new Promise<string>((resolve, reject) => {
        const blob = new Blob([buffer as unknown as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            const commaIndex = reader.result.indexOf(",");
            resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
          } else {
            reject(new Error("FileReader result is not a string"));
          }
        };
        reader.onerror = () => reject(reader.error || new Error("FileReader read error"));
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn("FileReader base64 conversion failed, falling back to chunked conversion:", err);
    }
  }

  // Chunked fallback (32KB chunks) to prevent main-thread freezing and call stack overflow
  let binary = "";
  const CHUNK_SIZE = 32768;
  const len = buffer.byteLength;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, len);
    const chunk = buffer.subarray(i, end);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return typeof window !== "undefined" && typeof window.btoa === "function"
    ? window.btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}

/**
 * Resolves local or relative image URLs against notePath using Tauri convertFileSrc.
 */
function resolveImageSrc(rawSrc: string, notePath?: string): string {
  if (!rawSrc) return "";
  if (/^(https?:|data:|blob:|asset:|tauri:)/i.test(rawSrc)) {
    return rawSrc;
  }

  const isTauriEnv =
    typeof window !== "undefined" &&
    Boolean((window as any).__TAURI_INTERNALS__);

  // If already an absolute path (e.g. C:/... or /...)
  if (/^[a-zA-Z]:[/\\]/.test(rawSrc) || rawSrc.startsWith("/")) {
    if (isTauriEnv) {
      try {
        return convertFileSrc(rawSrc);
      } catch (err) {
        console.warn("convertFileSrc failed for absolute path:", rawSrc, err);
      }
    }
    return rawSrc;
  }

  if (!notePath) return rawSrc;

  const normalizedNotePath = notePath.replace(/\\/g, "/");
  let baseDir: string;
  if (/\.(md|markdown)$/i.test(normalizedNotePath)) {
    const lastSlash = normalizedNotePath.lastIndexOf("/");
    baseDir = lastSlash >= 0 ? normalizedNotePath.substring(0, lastSlash) : normalizedNotePath;
  } else {
    baseDir = normalizedNotePath.replace(/\/+$/, "");
  }

  if (!baseDir) return rawSrc;

  const isWindowsAbsolute = /^[a-zA-Z]:/.test(baseDir);
  const isUnixAbsolute = baseDir.startsWith("/");

  const cleanRel = rawSrc.replace(/\\/g, "/");
  const baseSegments = baseDir.split("/").filter((s) => s.length > 0 && s !== ".");
  const relSegments = cleanRel.split("/").filter((s) => s.length > 0 && s !== ".");

  for (const seg of relSegments) {
    if (seg === "..") {
      if (baseSegments.length > (isWindowsAbsolute ? 1 : 0)) {
        baseSegments.pop();
      }
    } else {
      baseSegments.push(seg);
    }
  }

  let absPath: string;
  if (isWindowsAbsolute) {
    absPath = baseSegments.join("/");
  } else if (isUnixAbsolute) {
    absPath = "/" + baseSegments.join("/");
  } else {
    absPath = baseSegments.join("/");
  }

  if (isTauriEnv) {
    try {
      return convertFileSrc(absPath);
    } catch (err) {
      console.warn("convertFileSrc failed for path:", absPath, err);
    }
  }

  return absPath;
}

/**
 * Fetches raw binary image data as Uint8Array from data URI or URL.
 */
async function fetchImageBytes(src: string): Promise<Uint8Array | null> {
  if (!src) return null;

  // Case 1: Base64 data URL
  if (src.startsWith("data:")) {
    try {
      const commaIdx = src.indexOf(",");
      if (commaIdx >= 0) {
        const base64Part = src.slice(commaIdx + 1).trim();
        const binary = atob(base64Part);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
    } catch (e) {
      console.warn("Failed to decode base64 data URL:", e);
      return null;
    }
  }

  // Case 2: Network / Asset protocol fetch
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;
    const res = await fetch(src, controller ? { signal: controller.signal } : undefined);
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const ab = await res.arrayBuffer();
      return new Uint8Array(ab);
    }
  } catch (err) {
    console.warn("fetchImageBytes failed for:", src, err);
  }

  return null;
}

/**
 * Loads an HTMLImageElement to determine natural width and height.
 */
function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const img = new Image();
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 4000);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/**
 * Extracts PNG binary bytes from a loaded HTMLImageElement via canvas fallback.
 */
function extractBytesFromImageElement(img: HTMLImageElement): Uint8Array | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    if (canvas.width <= 0 || canvas.height <= 0) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const comma = dataUrl.indexOf(",");
    if (comma >= 0) {
      const b64 = dataUrl.slice(comma + 1).trim();
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }
  } catch (err) {
    console.warn("Canvas fallback byte extraction failed:", err);
  }
  return null;
}

/**
 * Detects image format from bytes signature or file extension.
 */
function detectImageType(
  rawSrc: string,
  resolvedSrc: string,
  bytes: Uint8Array
): "jpg" | "png" | "gif" | "bmp" {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return "png";
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      return "jpg";
    }
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return "gif";
    }
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return "bmp";
    }
  }

  const checkStr = (rawSrc + " " + resolvedSrc).toLowerCase();
  if (checkStr.includes(".jpg") || checkStr.includes(".jpeg") || checkStr.includes("image/jpeg")) {
    return "jpg";
  }
  if (checkStr.includes(".gif") || checkStr.includes("image/gif")) {
    return "gif";
  }
  if (checkStr.includes(".bmp") || checkStr.includes("image/bmp")) {
    return "bmp";
  }
  return "png";
}

/**
 * Creates a docx ImageRun or fallback TextRun for an image token.
 */
async function createImageRun(
  href: string,
  altText: string,
  notePath?: string
): Promise<ParagraphChild> {
  try {
    const resolvedSrc = resolveImageSrc(href, notePath);
    let imageBytes = await fetchImageBytes(resolvedSrc);
    let dims = { width: 550, height: 350 };

    if (typeof Image !== "undefined") {
      const imgLoadResult = await loadHtmlImage(resolvedSrc);
      if (imgLoadResult) {
        dims = {
          width: imgLoadResult.naturalWidth || 550,
          height: imgLoadResult.naturalHeight || 350,
        };
        if (!imageBytes) {
          imageBytes = extractBytesFromImageElement(imgLoadResult);
        }
      }
    }

    if (!imageBytes || imageBytes.length === 0) {
      return new TextRun({
        text: `[图片: ${altText || href}]`,
        italics: true,
        color: "64748B",
        font: CHINESE_FONT_CONFIG,
      });
    }

    const maxWidth = 550;
    const maxHeight = 400;
    let targetWidth = dims.width || 550;
    let targetHeight = dims.height || 350;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const scale = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }
    targetWidth = Math.min(targetWidth, maxWidth);
    targetHeight = Math.min(targetHeight, maxHeight);
    if (targetWidth <= 0) targetWidth = maxWidth;
    if (targetHeight <= 0) targetHeight = Math.round((targetWidth * 3) / 4);

    const imgType = detectImageType(href, resolvedSrc, imageBytes);

    return new ImageRun({
      data: imageBytes,
      transformation: {
        width: targetWidth,
        height: targetHeight,
      },
      type: imgType,
      altText: altText ? { title: altText, description: altText, name: altText } : undefined,
    });
  } catch (err) {
    console.warn("createImageRun error for:", href, err);
    return new TextRun({
      text: `[图片: ${altText || href}]`,
      italics: true,
      color: "64748B",
      font: CHINESE_FONT_CONFIG,
    });
  }
}

/**
 * Recursively converts marked inline tokens to docx ParagraphChild elements (TextRun, ExternalHyperlink, ImageRun).
 */
async function renderInlineTokens(
  tokens: Token[],
  format: InlineFormat = {},
  notePath?: string
): Promise<ParagraphChild[]> {
  const runs: ParagraphChild[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          runs.push(...(await renderInlineTokens(textToken.tokens, format, notePath)));
        } else {
          const raw = textToken.text || "";
          runs.push(
            new TextRun({
              text: raw,
              bold: format.bold,
              italics: format.italics,
              strike: format.strike,
              underline: format.underline ? {} : undefined,
              color: format.color,
              font: format.code ? CODE_FONT : CHINESE_FONT_CONFIG,
            })
          );
        }
        break;
      }
      case "strong": {
        const strongToken = token as Tokens.Strong;
        runs.push(
          ...(await renderInlineTokens(
            strongToken.tokens || [],
            {
              ...format,
              bold: true,
            },
            notePath
          ))
        );
        break;
      }
      case "em": {
        const emToken = token as Tokens.Em;
        runs.push(
          ...(await renderInlineTokens(
            emToken.tokens || [],
            {
              ...format,
              italics: true,
            },
            notePath
          ))
        );
        break;
      }
      case "del": {
        const delToken = token as Tokens.Del;
        runs.push(
          ...(await renderInlineTokens(
            delToken.tokens || [],
            {
              ...format,
              strike: true,
            },
            notePath
          ))
        );
        break;
      }
      case "codespan": {
        const codeToken = token as Tokens.Codespan;
        runs.push(
          new TextRun({
            text: codeToken.text,
            font: CODE_FONT,
            bold: format.bold,
            italics: format.italics,
            strike: format.strike,
            shading: { fill: "F1F5F9" },
            color: "C7254E",
          })
        );
        break;
      }
      case "link": {
        const linkToken = token as Tokens.Link;
        const linkChildren: ParagraphChild[] = [];
        if (linkToken.tokens && linkToken.tokens.length > 0) {
          linkChildren.push(
            ...(await renderInlineTokens(
              linkToken.tokens,
              {
                ...format,
                color: "0969DA",
                underline: true,
              },
              notePath
            ))
          );
        } else {
          linkChildren.push(
            new TextRun({
              text: linkToken.text || linkToken.href,
              color: "0969DA",
              underline: {},
              bold: format.bold,
              italics: format.italics,
              strike: format.strike,
              font: CHINESE_FONT_CONFIG,
            })
          );
        }
        runs.push(
          new ExternalHyperlink({
            children: linkChildren,
            link: linkToken.href || "#",
          })
        );
        break;
      }
      case "wikilink": {
        const wlToken = token as unknown as { alias?: string; target?: string; raw?: string };
        const displayText = wlToken.alias || wlToken.target || "";
        runs.push(
          new TextRun({
            text: `[[${displayText}]]`,
            color: "0969DA",
            bold: format.bold,
            italics: format.italics,
            strike: format.strike,
            underline: format.underline ? {} : undefined,
            font: CHINESE_FONT_CONFIG,
          })
        );
        break;
      }
      case "image": {
        const imgToken = token as Tokens.Image;
        const imageRun = await createImageRun(imgToken.href, imgToken.text || "", notePath);
        runs.push(imageRun);
        break;
      }
      case "br": {
        runs.push(new TextRun({ break: 1 }));
        break;
      }
      case "escape": {
        const escapeToken = token as Tokens.Escape;
        runs.push(
          new TextRun({
            text: escapeToken.text,
            bold: format.bold,
            italics: format.italics,
            strike: format.strike,
            font: format.code ? CODE_FONT : CHINESE_FONT_CONFIG,
          })
        );
        break;
      }
      default: {
        const anyToken = token as { tokens?: Token[]; text?: string };
        if (anyToken.tokens && anyToken.tokens.length > 0) {
          runs.push(...(await renderInlineTokens(anyToken.tokens, format, notePath)));
        } else if (anyToken.text) {
          runs.push(
            new TextRun({
              text: anyToken.text,
              bold: format.bold,
              italics: format.italics,
              strike: format.strike,
              font: format.code ? CODE_FONT : CHINESE_FONT_CONFIG,
            })
          );
        }
        break;
      }
    }
  }

  return runs;
}

/**
 * Converts a code block into a styled single-cell table with monospace font and shaded background
 */
function convertCodeBlock(token: Tokens.Code): Table {
  const codeLines = (token.text || "").split("\n");
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F8FAFC" },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: codeLines.map(
              (line) =>
                new Paragraph({
                  spacing: { before: 20, after: 20, line: 240 },
                  children: [
                    new TextRun({
                      text: line || " ",
                      font: CODE_FONT,
                      size: 19,
                      color: "1E293B",
                    }),
                  ],
                })
            ),
          }),
        ],
      }),
    ],
  });
}

/**
 * Converts a table token to a docx Table with padded cells and clean borders
 */
async function convertTable(token: Tokens.Table, notePath?: string): Promise<Table> {
  const getCellAlignment = (align?: string | null) => {
    if (align === "center") return AlignmentType.CENTER;
    if (align === "right") return AlignmentType.RIGHT;
    return AlignmentType.LEFT;
  };

  const headerCells: TableCell[] = [];
  for (let colIdx = 0; colIdx < token.header.length; colIdx++) {
    const cell = token.header[colIdx];
    const align = cell.align || (token.align && token.align[colIdx]);
    const inlineTokens =
      cell.tokens && cell.tokens.length > 0
        ? cell.tokens
        : ([{ type: "text", text: cell.text || "" }] as unknown as Token[]);
    const runs = await renderInlineTokens(inlineTokens, { bold: true }, notePath);

    headerCells.push(
      new TableCell({
        shading: { fill: "F1F5F9" },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({
            alignment: getCellAlignment(align),
            children: runs,
          }),
        ],
      })
    );
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells,
  });

  const bodyRows: TableRow[] = [];
  for (const row of token.rows) {
    const rowCells: TableCell[] = [];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx];
      const align = cell.align || (token.align && token.align[colIdx]);
      const inlineTokens =
        cell.tokens && cell.tokens.length > 0
          ? cell.tokens
          : ([{ type: "text", text: cell.text || "" }] as unknown as Token[]);
      const runs = await renderInlineTokens(inlineTokens, {}, notePath);

      rowCells.push(
        new TableCell({
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
          children: [
            new Paragraph({
              alignment: getCellAlignment(align),
              children: runs,
            }),
          ],
        })
      );
    }
    bodyRows.push(new TableRow({ children: rowCells }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    },
    rows: [headerRow, ...bodyRows],
  });
}

/**
 * Converts unordered and ordered lists into docx elements, maintaining numbering configs for nested levels.
 */
async function convertListTokens(
  listToken: Tokens.List,
  level: number,
  inheritedOrderedRef: string | null,
  getOrCreateOrderedRef: () => string,
  notePath?: string
): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];

  let currentOrderedRef = inheritedOrderedRef;
  if (listToken.ordered && !currentOrderedRef) {
    currentOrderedRef = getOrCreateOrderedRef();
  }

  for (const item of listToken.items) {
    const isTask = item.task;
    const taskPrefix = isTask ? (item.checked ? "[x] " : "[ ] ") : "";
    let isFirstParagraphInItem = true;

    for (const subToken of item.tokens) {
      if (subToken.type === "list") {
        elements.push(
          ...(await convertListTokens(
            subToken as Tokens.List,
            level + 1,
            currentOrderedRef,
            getOrCreateOrderedRef,
            notePath
          ))
        );
      } else if (subToken.type === "paragraph" || subToken.type === "text") {
        const inlineTokens =
          (subToken as { tokens?: Token[] }).tokens || [
            { type: "text", text: (subToken as { text?: string }).text || "" } as unknown as Token,
          ];
        const runs = await renderInlineTokens(inlineTokens, {}, notePath);
        if (isFirstParagraphInItem && taskPrefix) {
          runs.unshift(
            new TextRun({
              text: taskPrefix,
              bold: true,
              font: CODE_FONT,
            })
          );
        }

        const p = new Paragraph({
          bullet: !listToken.ordered ? { level } : undefined,
          numbering:
            listToken.ordered && currentOrderedRef
              ? { reference: currentOrderedRef, level }
              : undefined,
          children: runs,
          spacing: {
            before: isFirstParagraphInItem ? 40 : 20,
            after: 40,
            line: 276,
          },
        });
        elements.push(p);
        isFirstParagraphInItem = false;
      } else if (subToken.type === "code") {
        elements.push(convertCodeBlock(subToken as Tokens.Code));
      } else if (subToken.type === "table") {
        elements.push(await convertTable(subToken as Tokens.Table, notePath));
      } else {
        const runs = await renderInlineTokens(
          (subToken as { tokens?: Token[] }).tokens || [],
          {},
          notePath
        );
        elements.push(
          new Paragraph({
            bullet: !listToken.ordered ? { level } : undefined,
            numbering:
              listToken.ordered && currentOrderedRef
                ? { reference: currentOrderedRef, level }
                : undefined,
            children: runs,
          })
        );
      }
    }

    if (item.tokens.length === 0 && item.text) {
      elements.push(
        new Paragraph({
          bullet: !listToken.ordered ? { level } : undefined,
          numbering:
            listToken.ordered && currentOrderedRef
              ? { reference: currentOrderedRef, level }
              : undefined,
          children: [
            new TextRun({
              text: taskPrefix + item.text,
              font: CHINESE_FONT_CONFIG,
            }),
          ],
        })
      );
    }
  }

  return elements;
}

/**
 * Export Markdown note content to a DOCX document
 */
export async function exportNoteToDocx(
  noteName: string,
  markdownContent: string,
  notePath?: string
): Promise<boolean> {
  const suggestedFilename = `${noteName.replace(/\.md$/i, "")}.docx`;

  const chosenPath = await fileStore.pickSavePath(
    suggestedFilename,
    "docx",
    "Word 文档 (*.docx)"
  );

  if (!chosenPath) {
    return false;
  }

  const tokens = marked.lexer(markdownContent);
  const children: (Paragraph | Table)[] = [];

  const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };

  const numberingConfigs: {
    reference: string;
    levels: {
      level: number;
      format: (typeof LevelFormat)[keyof typeof LevelFormat];
      text: string;
      alignment: (typeof AlignmentType)[keyof typeof AlignmentType];
    }[];
  }[] = [];

  let listCounter = 0;
  const getOrCreateOrderedRef = (): string => {
    listCounter++;
    const reference = `order-list-${listCounter}`;
    numberingConfigs.push({
      reference,
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START },
        { level: 1, format: LevelFormat.DECIMAL, text: "%2.", alignment: AlignmentType.START },
        { level: 2, format: LevelFormat.DECIMAL, text: "%3.", alignment: AlignmentType.START },
        { level: 3, format: LevelFormat.DECIMAL, text: "%4.", alignment: AlignmentType.START },
        { level: 4, format: LevelFormat.DECIMAL, text: "%5.", alignment: AlignmentType.START },
        { level: 5, format: LevelFormat.DECIMAL, text: "%6.", alignment: AlignmentType.START },
        { level: 6, format: LevelFormat.DECIMAL, text: "%7.", alignment: AlignmentType.START },
        { level: 7, format: LevelFormat.DECIMAL, text: "%8.", alignment: AlignmentType.START },
        { level: 8, format: LevelFormat.DECIMAL, text: "%9.", alignment: AlignmentType.START },
      ],
    });
    return reference;
  };

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const headingToken = token as Tokens.Heading;
        children.push(
          new Paragraph({
            heading: headingMap[headingToken.depth] || HeadingLevel.HEADING_1,
            children: await renderInlineTokens(headingToken.tokens || [], { bold: true }, notePath),
            spacing: {
              before: headingToken.depth === 1 ? 300 : headingToken.depth === 2 ? 240 : 180,
              after: 100,
            },
          })
        );
        break;
      }
      case "paragraph": {
        const paragraphToken = token as Tokens.Paragraph;
        const runs = await renderInlineTokens(paragraphToken.tokens || [], {}, notePath);
        const isOnlyImage = runs.length === 1 && runs[0] instanceof ImageRun;
        children.push(
          new Paragraph({
            alignment: isOnlyImage ? AlignmentType.CENTER : undefined,
            children: runs,
            spacing: isOnlyImage
              ? { before: 120, after: 120 }
              : {
                  before: 60,
                  after: 120,
                  line: 276,
                },
          })
        );
        break;
      }
      case "image": {
        const imgToken = token as Tokens.Image;
        const imageRun = await createImageRun(imgToken.href, imgToken.text || "", notePath);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [imageRun],
            spacing: { before: 120, after: 120 },
          })
        );
        break;
      }
      case "blockquote": {
        const bqToken = token as Tokens.Blockquote;
        const bqTokens = bqToken.tokens || [];
        for (const sub of bqTokens) {
          if (sub.type === "list") {
            children.push(
              ...(await convertListTokens(
                sub as Tokens.List,
                0,
                null,
                getOrCreateOrderedRef,
                notePath
              ))
            );
          } else {
            const subTokens = (sub as { tokens?: Token[] }).tokens || [];
            children.push(
              new Paragraph({
                indent: { left: 720 },
                border: {
                  left: {
                    color: "CBD5E1",
                    space: 12,
                    style: BorderStyle.SINGLE,
                    size: 18,
                  },
                },
                children: await renderInlineTokens(subTokens, {}, notePath),
                spacing: { before: 60, after: 60, line: 276 },
              })
            );
          }
        }
        break;
      }
      case "code": {
        children.push(convertCodeBlock(token as Tokens.Code));
        break;
      }
      case "table": {
        children.push(await convertTable(token as Tokens.Table, notePath));
        break;
      }
      case "list": {
        const listToken = token as Tokens.List;
        let orderedRef: string | null = null;
        if (listToken.ordered) {
          orderedRef = getOrCreateOrderedRef();
        }
        children.push(
          ...(await convertListTokens(
            listToken,
            0,
            orderedRef,
            getOrCreateOrderedRef,
            notePath
          ))
        );
        break;
      }
      case "hr": {
        children.push(
          new Paragraph({
            border: {
              bottom: {
                color: "CBD5E1",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { before: 200, after: 200 },
          })
        );
        break;
      }
      case "space": {
        break;
      }
      default: {
        const anyToken = token as { tokens?: Token[]; text?: string };
        if (anyToken.tokens && anyToken.tokens.length > 0) {
          children.push(
            new Paragraph({
              children: await renderInlineTokens(anyToken.tokens, {}, notePath),
              spacing: { before: 60, after: 120 },
            })
          );
        }
        break;
      }
    }
  }

  const doc = new Document({
    numbering: numberingConfigs.length > 0 ? { config: numberingConfigs } : undefined,
    styles: {
      default: {
        document: {
          run: {
            font: CHINESE_FONT_CONFIG,
            size: 22, // 11pt
            color: "1E293B",
          },
          paragraph: {
            spacing: {
              line: 276,
              before: 60,
              after: 120,
            },
          },
        },
        heading1: {
          run: {
            font: CHINESE_FONT_CONFIG,
            bold: true,
            size: 36, // 18pt
            color: "0F172A",
          },
          paragraph: {
            spacing: { before: 280, after: 120 },
          },
        },
        heading2: {
          run: {
            font: CHINESE_FONT_CONFIG,
            bold: true,
            size: 30, // 15pt
            color: "1E293B",
          },
          paragraph: {
            spacing: { before: 220, after: 100 },
          },
        },
        heading3: {
          run: {
            font: CHINESE_FONT_CONFIG,
            bold: true,
            size: 26, // 13pt
            color: "334155",
          },
          paragraph: {
            spacing: { before: 180, after: 80 },
          },
        },
        heading4: {
          run: {
            font: CHINESE_FONT_CONFIG,
            bold: true,
            size: 24, // 12pt
            color: "334155",
          },
          paragraph: {
            spacing: { before: 140, after: 60 },
          },
        },
        heading5: {
          run: {
            font: CHINESE_FONT_CONFIG,
            bold: true,
            size: 22,
            color: "475569",
          },
          paragraph: {
            spacing: { before: 120, after: 60 },
          },
        },
        heading6: {
          run: {
            font: CHINESE_FONT_CONFIG,
            bold: true,
            size: 20,
            color: "64748B",
          },
          paragraph: {
            spacing: { before: 100, after: 40 },
          },
        },
      },
    },
    sections: [
      {
        children: children.length > 0 ? children : [new Paragraph({ children: [] })],
      },
    ],
  });

  const buffer = await (Packer as unknown as { toUint8Array: (doc: Document) => Promise<Uint8Array> }).toUint8Array(doc);

  const base64 = await uint8ArrayToBase64Async(buffer);

  await fileStore.writeBinaryFile(chosenPath, base64);
  snackbar({ message: `已成功导出为 DOCX: ${suggestedFilename}`, placement: "top" });
  return true;
}
