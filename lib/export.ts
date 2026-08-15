import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db, type Book, type Chapter, type Scene } from "@/lib/db";
import { notoDevanagariBase64 } from "@/lib/notoDevanagariBase64";

interface TipTapMark {
  type?: string;
}

interface TipTapNode {
  type?: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: { textAlign?: string; level?: number };
}

type ParaAlign = "left" | "center" | "right" | "justify";

interface RunData {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface ParaData {
  runs: RunData[];
  align: ParaAlign;
  heading: boolean;
}

function toAlign(value: string | undefined): ParaAlign {
  if (value === "center" || value === "right" || value === "justify") return value;
  return "left";
}

function tiptapJsonToParagraphs(json: string): ParaData[] {
  try {
    const parsed = JSON.parse(json) as TipTapNode;
    const paras: ParaData[] = [];
    const walk = (node: TipTapNode) => {
      if (node.type === "paragraph" || node.type === "heading") {
        const runs: RunData[] = (node.content || [])
          .filter((c) => c.text)
          .map((c) => ({
            text: c.text || "",
            bold: !!c.marks?.some((m) => m.type === "bold"),
            italic: !!c.marks?.some((m) => m.type === "italic"),
            underline: !!c.marks?.some((m) => m.type === "underline"),
          }));
        paras.push({ runs, align: toAlign(node.attrs?.textAlign), heading: node.type === "heading" });
      } else if (node.content) {
        node.content.forEach(walk);
      }
    };
    if (parsed.content) parsed.content.forEach(walk);
    return paras;
  } catch {
    return [];
  }
}

function paraText(p: ParaData): string {
  return p.runs.map((r) => r.text).join("");
}

// Matches any character in the Devanagari Unicode block (covers Hindi,
// Marathi, Sanskrit, etc.).
const DEVANAGARI_RE = /[\u0900-\u097F]/;

async function getManuscriptData(bookId: string) {
  const book = await db.books.get(bookId);
  const chapters = await db.chapters.where("bookId").equals(bookId).sortBy("order");
  const chapterData: { chapter: Chapter; scenes: Scene[] }[] = [];
  for (const chapter of chapters) {
    const scenes = await db.scenes.where("chapterId").equals(chapter.id).sortBy("order");
    chapterData.push({ chapter, scenes });
  }
  return { book: book as Book, chapterData };
}

// ============================================================
// DOCX export — Word/LibreOffice shape Devanagari correctly on
// their own, so this needs no special handling for Hindi text.
// ============================================================

const DOCX_ALIGN: Record<ParaAlign, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

export async function exportToDocx(bookId: string) {
  const { book, chapterData } = await getManuscriptData(bookId);
  const children: Paragraph[] = [
    new Paragraph({ text: book.title, heading: HeadingLevel.TITLE, alignment: "center" }),
    new Paragraph({ text: `by ${book.author || "Unknown"}`, alignment: "center" }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  chapterData.forEach(({ chapter, scenes }, idx) => {
    if (chapter.title && chapter.title.trim()) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: chapter.title, bold: true, size: 32 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );
    }
    scenes.forEach((scene) => {
      const paras = tiptapJsonToParagraphs(scene.content);
      paras.forEach((p) => {
        if (!paraText(p).trim()) return;
        children.push(
          new Paragraph({
            children: p.runs.map(
              (r) =>
                new TextRun({
                  text: r.text,
                  bold: p.heading || r.bold,
                  italics: r.italic,
                  underline: r.underline ? {} : undefined,
                  size: p.heading ? 28 : undefined,
                })
            ),
            alignment: DOCX_ALIGN[p.align],
            spacing: { after: 200 },
            indent: p.align === "left" && !p.heading ? { firstLine: 480 } : undefined,
          })
        );
      });
    });
    if (idx < chapterData.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${book.title || "manuscript"}.docx`);
}

// ============================================================
// PDF export — two paths:
//  1. Pure Latin content -> fast, real selectable/searchable text
//     via jsPDF's built-in fonts, with manual word-wrap so bold/
//     italic/underline/alignment are preserved.
//  2. Any Devanagari content -> rendered via the browser's own
//     text layout (which shapes Devanagari correctly) onto an
//     off-screen page, captured as an image, and placed into the
//     PDF. This trades away selectable/searchable text for pages
//     that are guaranteed to look right.
// ============================================================

function manuscriptHasDevanagari(
  book: Book,
  chapterData: { chapter: Chapter; scenes: Scene[] }[]
): boolean {
  if (DEVANAGARI_RE.test(book.title || "") || DEVANAGARI_RE.test(book.author || "")) return true;
  return chapterData.some(
    ({ chapter, scenes }) =>
      DEVANAGARI_RE.test(chapter.title || "") || scenes.some((s) => DEVANAGARI_RE.test(s.content || ""))
  );
}

// ---- Path 1: real-text PDF (Latin only) ----

interface Word {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  width: number;
}

function setPdfStyle(doc: jsPDF, bold: boolean, italic: boolean, size: number) {
  const style = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
  doc.setFont("times", style);
  doc.setFontSize(size);
}

function paraToWords(doc: jsPDF, p: ParaData, fontSize: number, indentFirst: boolean): Word[] {
  const words: Word[] = [];
  if (indentFirst) {
    setPdfStyle(doc, false, false, fontSize);
    words.push({ text: "     ", bold: false, italic: false, underline: false, width: doc.getTextWidth("     ") });
  }
  p.runs.forEach((run) => {
    const tokens = run.text.split(/(\s+)/).filter((t) => t.length > 0);
    tokens.forEach((tok) => {
      setPdfStyle(doc, run.bold || p.heading, run.italic, fontSize);
      words.push({
        text: tok,
        bold: run.bold || p.heading,
        italic: run.italic,
        underline: run.underline,
        width: doc.getTextWidth(tok),
      });
    });
  });
  return words;
}

function drawWordLine(
  doc: jsPDF,
  line: Word[],
  y: number,
  align: ParaAlign,
  marginX: number,
  pageWidth: number,
  maxWidth: number,
  isLastLine: boolean,
  fontSize: number
) {
  const naturalWidth = line.reduce((sum, w) => sum + w.width, 0);
  let x = marginX;
  let extraPerGap = 0;

  if (align === "center") {
    x = marginX + (maxWidth - naturalWidth) / 2;
  } else if (align === "right") {
    x = pageWidth - marginX - naturalWidth;
  } else if (align === "justify" && !isLastLine && line.length > 1) {
    const gaps = line.filter((w) => /^\s+$/.test(w.text)).length;
    if (gaps > 0) extraPerGap = (maxWidth - naturalWidth) / gaps;
  }

  line.forEach((w) => {
    if (!/^\s+$/.test(w.text)) {
      setPdfStyle(doc, w.bold, w.italic, fontSize);
      doc.text(w.text, x, y);
      if (w.underline) {
        doc.setLineWidth(0.6);
        doc.line(x, y + 2, x + w.width, y + 2);
      }
    }
    x += w.width + (extraPerGap && /^\s+$/.test(w.text) ? extraPerGap : 0);
  });
}

async function exportToPdfText(book: Book, chapterData: { chapter: Chapter; scenes: Scene[] }[]) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 72;
  const marginTop = 90;
  const marginBottom = 72;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = marginTop;

  setPdfStyle(doc, true, false, 20);
  doc.text(book.title || "Untitled", pageWidth / 2, 200, { align: "center" });
  setPdfStyle(doc, false, false, 12);
  doc.text(`by ${book.author || "Unknown"}`, pageWidth / 2, 230, { align: "center" });
  doc.addPage();
  y = marginTop;

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  chapterData.forEach(({ chapter, scenes }, idx) => {
    if (chapter.title && chapter.title.trim()) {
      setPdfStyle(doc, true, false, 18);
      ensureSpace(34);
      doc.text(chapter.title, pageWidth / 2, y, { align: "center" });
      y += 34;
    }

    scenes.forEach((scene) => {
      const paras = tiptapJsonToParagraphs(scene.content);
      paras.forEach((p) => {
        if (!paraText(p).trim()) return;
        const fontSize = p.heading ? 14 : 12;
        const lineHeight = p.heading ? 20 : 18;
        const indentFirst = p.align === "left" && !p.heading;
        const words = paraToWords(doc, p, fontSize, indentFirst);

        const lines: Word[][] = [];
        let current: Word[] = [];
        let currentWidth = 0;
        words.forEach((w) => {
          if (currentWidth + w.width > maxWidth && current.length > 0) {
            lines.push(current);
            current = [];
            currentWidth = 0;
            if (/^\s+$/.test(w.text)) return;
          }
          current.push(w);
          currentWidth += w.width;
        });
        if (current.length > 0) lines.push(current);

        lines.forEach((line, i) => {
          ensureSpace(lineHeight);
          drawWordLine(doc, line, y, p.align, marginX, pageWidth, maxWidth, i === lines.length - 1, fontSize);
          y += lineHeight;
        });
        y += 6;
      });
    });
    if (idx < chapterData.length - 1) {
      doc.addPage();
      y = marginTop;
    }
  });

  doc.save(`${book.title || "manuscript"}.pdf`);
}

// ---- Path 2: image-based PDF (handles Devanagari correctly) ----

const PAGE_W = 850;
const PAGE_H = 1100;
const MARGIN = 85;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_H = PAGE_H - MARGIN * 2;
const EXPORT_FONT_FAMILY = "NotoDevanagariExport, 'Times New Roman', serif";

let devanagariWebFontLoaded = false;
async function loadDevanagariWebFont() {
  if (devanagariWebFontLoaded || typeof document === "undefined") return;
  const fontFace = new FontFace(
    "NotoDevanagariExport",
    `url(data:font/truetype;charset=utf-8;base64,${notoDevanagariBase64})`
  );
  await fontFace.load();
  (document.fonts as unknown as { add: (f: FontFace) => void }).add(fontFace);
  devanagariWebFontLoaded = true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function paraToHtml(p: ParaData): string {
  const align = p.align === "justify" ? "justify" : p.align;
  const indent = p.align === "left" && !p.heading ? "text-indent:2em;" : "";
  const fontSize = p.heading ? "20px" : "16px";
  const runsHtml = p.runs
    .map((r) => {
      let style = "";
      if (r.bold || p.heading) style += "font-weight:bold;";
      if (r.italic) style += "font-style:italic;";
      if (r.underline) style += "text-decoration:underline;";
      return `<span style="${style}">${escapeHtml(r.text)}</span>`;
    })
    .join("");
  return `<p style="margin:0 0 14px 0; text-align:${align}; ${indent} font-size:${fontSize}; line-height:1.5;">${runsHtml}</p>`;
}

async function renderPagesToImages(blocksHtml: string[]): Promise<string[]> {
  await loadDevanagariWebFont();

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${PAGE_W}px`;
  container.style.background = "#ffffff";
  container.style.color = "#000000";
  container.style.fontFamily = EXPORT_FONT_FAMILY;
  document.body.appendChild(container);

  const images: string[] = [];
  let pageDiv = document.createElement("div");
  pageDiv.style.width = `${CONTENT_W}px`;
  pageDiv.style.margin = `${MARGIN}px`;
  container.appendChild(pageDiv);

  const flushPage = async () => {
    if (pageDiv.childNodes.length === 0) return;
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      width: PAGE_W,
      height: PAGE_H,
    });
    images.push(canvas.toDataURL("image/jpeg", 0.92));
    container.removeChild(pageDiv);
    pageDiv = document.createElement("div");
    pageDiv.style.width = `${CONTENT_W}px`;
    pageDiv.style.margin = `${MARGIN}px`;
    container.appendChild(pageDiv);
  };

  for (const html of blocksHtml) {
    if (html === "__PAGEBREAK__") {
      await flushPage();
      continue;
    }
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const node = temp.firstElementChild as HTMLElement;
    pageDiv.appendChild(node);
    if (pageDiv.offsetHeight > CONTENT_H && pageDiv.childNodes.length > 1) {
      pageDiv.removeChild(node);
      await flushPage();
      pageDiv.appendChild(node);
    }
  }
  await flushPage();

  document.body.removeChild(container);
  return images;
}

async function exportToPdfImage(book: Book, chapterData: { chapter: Chapter; scenes: Scene[] }[]) {
  const blocks: string[] = [];

  blocks.push(
    `<div style="height:${CONTENT_H}px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
      <div style="font-weight:bold; font-size:28px; margin-bottom:10px;">${escapeHtml(book.title || "Untitled")}</div>
      <div style="font-size:16px;">by ${escapeHtml(book.author || "Unknown")}</div>
    </div>`
  );
  blocks.push("__PAGEBREAK__");

  chapterData.forEach(({ chapter, scenes }, idx) => {
    if (chapter.title && chapter.title.trim()) {
      blocks.push(
        `<p style="text-align:center; font-weight:bold; font-size:22px; margin:0 0 24px 0;">${escapeHtml(chapter.title)}</p>`
      );
    }
    scenes.forEach((scene) => {
      const paras = tiptapJsonToParagraphs(scene.content);
      paras.forEach((p) => {
        if (!paraText(p).trim()) return;
        blocks.push(paraToHtml(p));
      });
    });
    if (idx < chapterData.length - 1) {
      blocks.push("__PAGEBREAK__");
    }
  });

  const images = await renderPagesToImages(blocks);

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pdfPageW = doc.internal.pageSize.getWidth();
  const pdfPageH = doc.internal.pageSize.getHeight();

  images.forEach((imgData, i) => {
    if (i > 0) doc.addPage();
    doc.addImage(imgData, "JPEG", 0, 0, pdfPageW, pdfPageH);
  });

  doc.save(`${book.title || "manuscript"}.pdf`);
}

export async function exportToPdf(bookId: string) {
  const { book, chapterData } = await getManuscriptData(bookId);
  if (manuscriptHasDevanagari(book, chapterData)) {
    await exportToPdfImage(book, chapterData);
  } else {
    await exportToPdfText(book, chapterData);
  }
}