import { marked } from "marked";
import DOMPurify from "dompurify";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { snackbar } from "mdui";
import { convertFileSrc } from "@tauri-apps/api/core";
import { fileStore } from "../services/fileStore";

const PDF_PRINT_STYLES = `
  .markdown-pdf-body {
    font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #1f2937;
    font-size: 14px;
    line-height: 1.75;
    word-break: break-word;
  }
  .markdown-pdf-body * {
    box-sizing: border-box;
  }
  .markdown-pdf-body h1,
  .markdown-pdf-body h2,
  .markdown-pdf-body h3,
  .markdown-pdf-body h4,
  .markdown-pdf-body h5,
  .markdown-pdf-body h6 {
    color: #111827;
    font-weight: 600;
    line-height: 1.35;
    margin-top: 1.5em;
    margin-bottom: 0.6em;
  }
  .markdown-pdf-body h1 {
    font-size: 24px;
    margin-top: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }
  .markdown-pdf-body h2 {
    font-size: 20px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f3f4f6;
  }
  .markdown-pdf-body h3 { font-size: 17px; }
  .markdown-pdf-body h4 { font-size: 15px; }
  .markdown-pdf-body h5 { font-size: 14px; }
  .markdown-pdf-body h6 { font-size: 13px; color: #6b7280; }
  .markdown-pdf-body p {
    margin: 0 0 1em 0;
  }
  .markdown-pdf-body ul,
  .markdown-pdf-body ol {
    margin: 0 0 1em 0;
    padding-left: 24px;
  }
  .markdown-pdf-body li {
    margin: 4px 0;
  }
  .markdown-pdf-body pre {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 1em 0;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12.5px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    overflow: hidden;
  }
  .markdown-pdf-body code {
    background-color: #f1f5f9;
    border-radius: 4px;
    padding: 2px 6px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12.5px;
    color: #c7254e;
  }
  .markdown-pdf-body pre code {
    background: transparent;
    padding: 0;
    color: #1e293b;
  }
  .markdown-pdf-body blockquote {
    border-left: 4px solid #cbd5e1;
    background-color: #f8fafc;
    margin: 1em 0;
    padding: 8px 16px;
    color: #4b5563;
  }
  .markdown-pdf-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.2em 0;
  }
  .markdown-pdf-body th,
  .markdown-pdf-body td {
    border: 1px solid #e2e8f0;
    padding: 8px 12px;
    text-align: left;
  }
  .markdown-pdf-body th {
    background-color: #f8fafc;
    font-weight: 600;
    color: #0f172a;
  }
  .markdown-pdf-body tr:nth-child(even) td {
    background-color: #fbfcfe;
  }
  .markdown-pdf-body hr {
    border: none;
    height: 1px;
    background-color: #e2e8f0;
    margin: 24px 0;
  }
  .markdown-pdf-body img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    display: block;
  }
  .markdown-pdf-body a {
    color: #0969da;
    text-decoration: underline;
  }
`;

/**
 * Asynchronously convert a Uint8Array into a base64 string.
 * Uses FileReader.readAsDataURL off the main thread for high performance,
 * with a chunked String.fromCharCode fallback if FileReader is unavailable or fails.
 */
export async function uint8ArrayToBase64Async(buffer: Uint8Array): Promise<string> {
  if (typeof FileReader !== "undefined" && typeof Blob !== "undefined") {
    try {
      return await new Promise<string>((resolve, reject) => {
        const blob = new Blob([buffer as unknown as BlobPart], { type: "application/pdf" });
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
      console.warn("FileReader base64 conversion failed, falling back to chunked encoding:", err);
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
  return window.btoa(binary);
}

/**
 * Resolves a local or relative image URL against notePath using Tauri convertFileSrc.
 */
function resolveImageSrc(rawSrc: string, notePath?: string): string {
  if (!rawSrc || !notePath) return rawSrc;
  if (/^(https?:|data:|blob:|asset:|tauri:)/i.test(rawSrc)) {
    return rawSrc;
  }

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

  const isTauriEnv =
    typeof window !== "undefined" &&
    Boolean((window as any).__TAURI_INTERNALS__);

  if (isTauriEnv) {
    try {
      return convertFileSrc(absPath);
    } catch (err) {
      console.warn("convertFileSrc failed for path:", absPath, err);
    }
  }

  return rawSrc;
}

/**
 * Preload all images inside the rendered container with a timeout fallback.
 */
async function waitForImagesToLoad(container: HTMLElement, timeoutMs = 4000): Promise<void> {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  if (images.length === 0) return;

  const loadPromises = images.map((img) => {
    if (img.complete && img.naturalWidth > 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        }
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  });

  const timerPromise = new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

  await Promise.race([Promise.all(loadPromises), timerPromise]);
}

interface BoundaryItem {
  type: "heading" | "img" | "tr" | "table" | "block";
  top: number;
  bottom: number;
}

interface CandidateBreak {
  y: number;
  priority: number;
}

interface DocumentLayout {
  headings: BoundaryItem[];
  imgElements: BoundaryItem[];
  tableRows: BoundaryItem[];
  candidateBreaks: CandidateBreak[];
  atomicRanges: Array<{ top: number; bottom: number }>;
}

/**
 * Extracts element boundaries and safe cut candidate coordinates in canvas pixel space.
 */
function extractDocumentLayout(
  container: HTMLElement,
  contentWrapper: HTMLElement,
  scale: number
): DocumentLayout {
  const containerRect = container.getBoundingClientRect();

  const headings: BoundaryItem[] = [];
  const imgElements: BoundaryItem[] = [];
  const tableRows: BoundaryItem[] = [];
  const candidateBreaks: CandidateBreak[] = [];
  const atomicRanges: Array<{ top: number; bottom: number }> = [];

  // 1. Headings (h1 - h6)
  contentWrapper.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0) {
      const top = (r.top - containerRect.top) * scale;
      const bottom = (r.bottom - containerRect.top) * scale;
      headings.push({ type: "heading", top, bottom });
      atomicRanges.push({ top, bottom });
      candidateBreaks.push({ y: top, priority: 100 });
      candidateBreaks.push({ y: bottom, priority: 60 });
    }
  });

  // 2. Images (img)
  contentWrapper.querySelectorAll("img").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0) {
      const top = (r.top - containerRect.top) * scale;
      const bottom = (r.bottom - containerRect.top) * scale;
      imgElements.push({ type: "img", top, bottom });
      atomicRanges.push({ top, bottom });
      candidateBreaks.push({ y: top, priority: 95 });
      candidateBreaks.push({ y: bottom, priority: 95 });
    }
  });

  // 3. Table Rows (tr)
  contentWrapper.querySelectorAll("tr").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0) {
      const top = (r.top - containerRect.top) * scale;
      const bottom = (r.bottom - containerRect.top) * scale;
      tableRows.push({ type: "tr", top, bottom });
      atomicRanges.push({ top, bottom });
      candidateBreaks.push({ y: top, priority: 90 });
      candidateBreaks.push({ y: bottom, priority: 90 });
    }
  });

  // 4. Block Elements (p, blockquote, pre, table, ul, ol, li, hr)
  contentWrapper
    .querySelectorAll("p, blockquote, pre, table, ul, ol, li, hr")
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) {
        const top = (r.top - containerRect.top) * scale;
        const bottom = (r.bottom - containerRect.top) * scale;
        const tag = el.tagName.toLowerCase();
        const priority = tag === "li" ? 85 : 95;
        candidateBreaks.push({ y: top, priority });
        candidateBreaks.push({ y: bottom, priority });
      }
    });

  // 5. Text Line Boundaries (inspect non-table text nodes to prevent horizontal text clipping)
  try {
    const walker = document.createTreeWalker(contentWrapper, NodeFilter.SHOW_TEXT);
    let textNode: Node | null = walker.nextNode();
    const range = document.createRange();

    while (textNode) {
      if (textNode.textContent && textNode.textContent.trim().length > 0) {
        const parent = textNode.parentElement;
        if (parent && !parent.closest("table")) {
          range.selectNodeContents(textNode);
          const rects = range.getClientRects();
          for (let i = 0; i < rects.length; i++) {
            const r = rects[i];
            if (r.height > 2) {
              const top = (r.top - containerRect.top) * scale;
              const bottom = (r.bottom - containerRect.top) * scale;
              atomicRanges.push({ top, bottom });
              candidateBreaks.push({ y: bottom, priority: 70 });
            }
          }
        }
      }
      textNode = walker.nextNode();
    }
  } catch (err) {
    console.warn("Failed to collect text line boundaries:", err);
  }

  return { headings, imgElements, tableRows, candidateBreaks, atomicRanges };
}

/**
 * Checks if a candidate cut coordinate falls strictly inside an atomic range (text line, image, row, heading).
 */
function isInsideAtomicRange(
  y: number,
  ranges: Array<{ top: number; bottom: number }>
): boolean {
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (y > r.top + 1 && y < r.bottom - 1) {
      return true;
    }
  }
  return false;
}

/**
 * Computes the optimal break point for a page chunk starting at currentY.
 */
function computeOptimalBreakPoint(
  currentY: number,
  pageContentHeightPx: number,
  canvasHeight: number,
  scale: number,
  layout: DocumentLayout
): number {
  const targetY = currentY + pageContentHeightPx;
  if (targetY >= canvasHeight) {
    return canvasHeight;
  }

  const { headings, imgElements, tableRows, candidateBreaks, atomicRanges } = layout;

  // 1. Enforce strict constraints on maxAllowedY:
  // - Avoid orphan headings: if a heading is positioned near bottom with less than 60px room below it, break before heading
  // - Avoid cutting images: break before the image if it would be cut in half
  // - Avoid cutting table rows: break between tr elements
  const minHeadingRoomPx = 60 * scale;
  let maxAllowedY = targetY;
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 10) {
    changed = false;
    iterations++;

    for (const h of headings) {
      if (h.top >= currentY + 1 && h.top < maxAllowedY) {
        if (maxAllowedY - h.bottom < minHeadingRoomPx) {
          if (h.top < maxAllowedY) {
            maxAllowedY = h.top;
            changed = true;
          }
        }
      }
    }

    for (const img of imgElements) {
      if (img.top >= currentY + 1 && img.top < maxAllowedY && img.bottom > maxAllowedY) {
        maxAllowedY = img.top;
        changed = true;
      }
    }

    for (const tr of tableRows) {
      if (tr.top >= currentY + 1 && tr.top < maxAllowedY && tr.bottom > maxAllowedY) {
        maxAllowedY = tr.top;
        changed = true;
      }
    }
  }

  const minSearchY = currentY + pageContentHeightPx * 0.7;

  // Filter valid candidates
  const validCandidates = candidateBreaks.filter((c) => {
    if (c.y <= currentY + 1 || c.y > maxAllowedY) return false;
    return !isInsideAtomicRange(c.y, atomicRanges);
  });

  // Try finding candidates in the preferred window [minSearchY, maxAllowedY]
  const preferredCandidates = validCandidates.filter((c) => c.y >= minSearchY);

  if (preferredCandidates.length > 0) {
    let best = preferredCandidates[0];
    let bestScore = -Infinity;
    for (const c of preferredCandidates) {
      const fillRate = (c.y - currentY) / pageContentHeightPx;
      const score = c.priority + fillRate * 30;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return Math.floor(best.y);
  }

  // If no candidate in preferred window, pick the highest valid candidate below maxAllowedY
  if (validCandidates.length > 0) {
    let best = validCandidates[0];
    for (const c of validCandidates) {
      if (c.y > best.y) {
        best = c;
      }
    }
    return Math.floor(best.y);
  }

  // If maxAllowedY was pulled back by an element top (orphan heading, image, or tr)
  if (maxAllowedY > currentY + 1 && maxAllowedY < targetY) {
    return Math.floor(maxAllowedY);
  }

  // Fallback gracefully to targetY only if a single atomic element exceeds pageContentHeightPx
  return Math.min(canvasHeight, Math.floor(targetY));
}

/**
 * Export Markdown note content to a PDF document with smart page breaking and relative image support.
 */
export async function exportNoteToPdf(
  noteName: string,
  markdownContent: string,
  notePath?: string
): Promise<boolean> {
  const suggestedFilename = `${noteName.replace(/\.md$/i, "")}.pdf`;

  const chosenPath = await fileStore.pickSavePath(
    suggestedFilename,
    "pdf",
    "PDF 文档 (*.pdf)"
  );

  if (!chosenPath) {
    return false;
  }

  const rawHtml = await marked.parse(markdownContent);
  const cleanHtml = DOMPurify.sanitize(rawHtml as string);

  const container = document.createElement("div");
  container.setAttribute("data-export-pdf-container", "true");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "720px";
  container.style.padding = "32px 40px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#1f2937";
  container.style.fontFamily =
    "Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.75";
  container.style.boxSizing = "border-box";
  container.style.zIndex = "-99999";

  const styleEl = document.createElement("style");
  styleEl.textContent = PDF_PRINT_STYLES;

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "markdown-pdf-body";
  contentWrapper.innerHTML = cleanHtml;

  container.appendChild(styleEl);
  container.appendChild(contentWrapper);
  document.body.appendChild(container);

  try {
    // 1. Resolve relative images (e.g. ./assets/... or assets/...) using Tauri convertFileSrc
    const images = Array.from(contentWrapper.querySelectorAll<HTMLImageElement>("img"));
    for (const img of images) {
      const rawSrc = img.getAttribute("src") || "";
      const resolved = resolveImageSrc(rawSrc, notePath);
      if (resolved && resolved !== rawSrc) {
        img.setAttribute("data-markdown-src", rawSrc);
        img.src = resolved;
      }
    }

    // 2. Wait for all images in contentWrapper to finish loading with timeout fallback
    await waitForImagesToLoad(contentWrapper, 4000);

    // 3. Render HTML container to high-resolution canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 720,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const marginX = 10;
    const marginY = 12;
    const printableWidth = 210 - marginX * 2; // 190 mm
    const printableHeight = 297 - marginY * 2; // 273 mm

    const pxPerMm = canvas.width / printableWidth;
    const pageContentHeightPx = Math.floor(printableHeight * pxPerMm);
    const scale = canvas.width / container.offsetWidth;

    // 4. Extract document layout element boundaries
    const layout = extractDocumentLayout(container, contentWrapper, scale);

    // 5. Smart page slicing
    let currentY = 0;
    let pageIndex = 0;

    while (currentY < canvas.height) {
      const breakY = computeOptimalBreakPoint(
        currentY,
        pageContentHeightPx,
        canvas.height,
        scale,
        layout
      );

      const startCutY = Math.round(currentY);
      const endCutY = Math.min(canvas.height, Math.round(breakY));
      const chunkHeightPx = endCutY - startCutY;

      if (chunkHeightPx <= 0) {
        break;
      }

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = chunkHeightPx;
      const pageCtx = pageCanvas.getContext("2d");
      if (pageCtx) {
        pageCtx.fillStyle = "#ffffff";
        pageCtx.fillRect(0, 0, canvas.width, chunkHeightPx);
        pageCtx.drawImage(
          canvas,
          0,
          startCutY,
          canvas.width,
          chunkHeightPx,
          0,
          0,
          canvas.width,
          chunkHeightPx
        );
      }

      const chunkHeightMm = chunkHeightPx / pxPerMm;
      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, "JPEG", marginX, marginY, printableWidth, chunkHeightMm);

      currentY = endCutY;
      pageIndex++;
    }

    // 6. Non-blocking asynchronous Base64 conversion
    const arrayBuffer = pdf.output("arraybuffer");
    const buffer = new Uint8Array(arrayBuffer);
    const base64 = await uint8ArrayToBase64Async(buffer);

    await fileStore.writeBinaryFile(chosenPath, base64);
    snackbar({ message: `已成功导出为 PDF: ${suggestedFilename}`, placement: "top" });
    return true;
  } catch (err) {
    console.error("导出 PDF 失败:", err);
    snackbar({ message: `导出 PDF 失败: ${err instanceof Error ? err.message : String(err)}`, placement: "top" });
    return false;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
