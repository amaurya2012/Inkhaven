import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
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
// Marathi, Sanskrit, etc.) so we know when a word needs the embedded font.
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

const DOCX_ALIGN: Record<ParaAlign, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

export async function exportToDocx(bookId: string) {
  const { book, chapterData } = await getManuscriptData(bookId);
  const children: Paragraph[] = [
    new Paragraph({
      text: book.title,
      heading: HeadingLevel.TITLE,
      alignment: "center",
    }),
    new Paragraph({
      text: `by ${book.author || "Unknown"}`,
      alignment: "center",
    }),
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

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${book.title || "manuscript"}.docx`);
}

// ---- PDF export ----
// Manual word-wrapping so bold/italic/underline runs and paragraph alignment
// (left/center/right/justify) are preserved, and so Devanagari (Hindi) text
// can be rendered using an embedded Unicode font — jsPDF's built-in fonts
// (Times/Helvetica) only support Latin script and would otherwise print
// garbled characters for Hindi text.

const DEVANAGARI_FONT_NAME = "NotoSansDevanagari";
let devanagariFontRegistered = false;

function registerDevanagariFont(doc: jsPDF) {
  if (devanagariFontRegistered) return;
  doc.addFileToVFS(`${DEVANAGARI_FONT_NAME}.ttf`, notoDevanagariBase64);
  doc.addFont(`${DEVANAGARI_FONT_NAME}.ttf`, DEVANAGARI_FONT_NAME, "normal");
  devanagariFontRegistered = true;
}

interface Word {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  devanagari: boolean;
  width: number;
}

function setPdfStyle(doc: jsPDF, bold: boolean, italic: boolean, size: number, devanagari: boolean) {
  if (devanagari) {
    // The embedded font only has one weight registered, so bold/italic
    // requests just render as regular Devanagari — still fully readable.
    doc.setFont(DEVANAGARI_FONT_NAME, "normal");
    doc.setFontSize(size);
    return;
  }
  const style = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
  doc.setFont("times", style);
  doc.setFontSize(size);
}

function paraToWords(doc: jsPDF, p: ParaData, fontSize: number, indentFirst: boolean): Word[] {
  const words: Word[] = [];
  if (indentFirst) {
    setPdfStyle(doc, false, false, fontSize, false);
    words.push({
      text: "     ",
      bold: false,
      italic: false,
      underline: false,
      devanagari: false,
      width: doc.getTextWidth("     "),
    });
  }
  p.runs.forEach((run) => {
    const tokens = run.text.split(/(\s+)/).filter((t) => t.length > 0);
    tokens.forEach((tok) => {
      const isDevanagari = DEVANAGARI_RE.test(tok);
      setPdfStyle(doc, run.bold || p.heading, run.italic, fontSize, isDevanagari);
      words.push({
        text: tok,
        bold: run.bold || p.heading,
        italic: run.italic,
        underline: run.underline,
        devanagari: isDevanagari,
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
      setPdfStyle(doc, w.bold, w.italic, fontSize, w.devanagari);
      doc.text(w.text, x, y);
      if (w.underline) {
        doc.setLineWidth(0.6);
        doc.line(x, y + 2, x + w.width, y + 2);
      }
    }
    x += w.width + (extraPerGap && /^\s+$/.test(w.text) ? extraPerGap : 0);
  });
}

export async function exportToPdf(bookId: string) {
  const { book, chapterData } = await getManuscriptData(bookId);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  registerDevanagariFont(doc);

  const marginX = 72;
  const marginTop = 90;
  const marginBottom = 72;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = marginTop;

  const titleIsDevanagari = DEVANAGARI_RE.test(book.title || "");
  setPdfStyle(doc, true, false, 20, titleIsDevanagari);
  doc.text(book.title || "Untitled", pageWidth / 2, 200, { align: "center" });
  const authorIsDevanagari = DEVANAGARI_RE.test(book.author || "");
  setPdfStyle(doc, false, false, 12, authorIsDevanagari);
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
      const chapterIsDevanagari = DEVANAGARI_RE.test(chapter.title);
      setPdfStyle(doc, true, false, 18, chapterIsDevanagari);
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