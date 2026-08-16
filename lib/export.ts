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
// PDF export
//
// Latin (English) paragraphs render as real, selectable/searchable
// text via jsPDF's built-in fonts, with manual word-wrap so bold/
// italic/underline/alignment are preserved.
//
// Any paragraph containing Devanagari (Hindi) is instead rasterized
// via the browser's own text layout — which shapes Devanagari
// correctly — and dropped into the PDF as a small inline image at
// the right position. Only Hindi paragraphs pay that cost; English
// content in the same book is completely unaffected.
// ============================================================

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

function drawTextParagraph(
  doc: jsPDF,
  p: ParaData,
  y: number,
  marginX: number,
  pageWidth: number,
  maxWidth: number,
  ensureSpace: (h: number) => void
): number {
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
  return y + 6;
}

// ---- Devanagari paragraph -> small inline image ----

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
  const lineHeightCss = p.heading ? "1.4" : "1.3";
  const runsHtml = p.runs
    .map((r) => {
      let style = "";
      if (r.bold || p.heading) style += "font-weight:bold;";
      if (r.italic) style += "font-style:italic;";
      if (r.underline) style += "text-decoration:underline;";
      return `<span style="${style}">${escapeHtml(r.text)}</span>`;
    })
    .join("");
  return `<div style="margin:0; text-align:${align}; ${indent} font-size:${fontSize}; line-height:${lineHeightCss};">${runsHtml}</div>`;
}

async function renderParagraphImage(p: ParaData, widthPt: number): Promise<{ dataUrl: string; heightPt: number }> {
  await loadDevanagariWebFont();

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${widthPt}px`;
  container.style.background = "#ffffff";
  container.style.color = "#000000";
  container.style.fontFamily = EXPORT_FONT_FAMILY;
  container.innerHTML = paraToHtml(p);
  document.body.appendChild(container);

  // Give the browser a couple of frames to actually complete layout for the
  // freshly-inserted element before capturing it — capturing too early was
  // occasionally producing a 0-height canvas, which cascaded into NaN
  // positions for everything rendered afterwards (showing up as big blank
  // gaps and misplaced content on later pages).
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const canvas = await html2canvas(container, { scale: 3, backgroundColor: "#ffffff" });
  const dataUrl = canvas.toDataURL("image/png");
  const heightPt = canvas.width > 0 ? widthPt * (canvas.height / canvas.width) : 20;

  document.body.removeChild(container);
  return { dataUrl, heightPt };
}

async function drawImageParagraph(
  doc: jsPDF,
  p: ParaData,
  y: number,
  marginX: number,
  pageWidth: number,
  maxWidth: number,
  ensureSpace: (h: number) => void
): Promise<number> {
  const { dataUrl, heightPt } = await renderParagraphImage(p, maxWidth);
  ensureSpace(heightPt);
  let x = marginX;
  if (p.align === "center") x = (pageWidth - maxWidth) / 2;
  doc.addImage(dataUrl, "PNG", x, y, maxWidth, heightPt);
  return y + heightPt + 4;
}

async function drawHeadingText(
  doc: jsPDF,
  text: string,
  y: number,
  pageWidth: number,
  maxWidth: number,
  ensureSpace: (h: number) => void
): Promise<number> {
  if (DEVANAGARI_RE.test(text)) {
    const fakePara: ParaData = { runs: [{ text, bold: true, italic: false, underline: false }], align: "center", heading: true };
    return drawImageParagraph(doc, fakePara, y, (pageWidth - maxWidth) / 2, pageWidth, maxWidth, ensureSpace);
  }
  setPdfStyle(doc, true, false, 18);
  ensureSpace(34);
  doc.text(text, pageWidth / 2, y, { align: "center" });
  return y + 34;
}

export async function exportToPdf(bookId: string) {
  const { book, chapterData } = await getManuscriptData(bookId);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 72;
  const marginTop = 90;
  const marginBottom = 72;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = marginTop;

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  // Title page
  const titleIsDevanagari = DEVANAGARI_RE.test(book.title || "");
  if (titleIsDevanagari) {
    const fakePara: ParaData = {
      runs: [{ text: book.title || "Untitled", bold: true, italic: false, underline: false }],
      align: "center",
      heading: true,
    };
    const { dataUrl, heightPt } = await renderParagraphImage(fakePara, maxWidth);
    doc.addImage(dataUrl, "PNG", (pageWidth - maxWidth) / 2, 180, maxWidth, heightPt);
  } else {
    setPdfStyle(doc, true, false, 20);
    doc.text(book.title || "Untitled", pageWidth / 2, 200, { align: "center" });
  }
  setPdfStyle(doc, false, false, 12);
  doc.text(`by ${book.author || "Unknown"}`, pageWidth / 2, 240, { align: "center" });
  doc.addPage();
  y = marginTop;

  for (let idx = 0; idx < chapterData.length; idx++) {
    const { chapter, scenes } = chapterData[idx];

    if (chapter.title && chapter.title.trim()) {
      y = await drawHeadingText(doc, chapter.title, y, pageWidth, maxWidth, ensureSpace);
    }

    for (const scene of scenes) {
      const paras = tiptapJsonToParagraphs(scene.content);
      for (const p of paras) {
        if (!paraText(p).trim()) continue;
        if (DEVANAGARI_RE.test(paraText(p))) {
          y = await drawImageParagraph(doc, p, y, marginX, pageWidth, maxWidth, ensureSpace);
        } else {
          y = drawTextParagraph(doc, p, y, marginX, pageWidth, maxWidth, ensureSpace);
        }
      }
    }

    if (idx < chapterData.length - 1) {
      doc.addPage();
      y = marginTop;
    }
  }

  doc.save(`${book.title || "manuscript"}.pdf`);
}