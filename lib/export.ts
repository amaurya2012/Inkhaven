import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { db, type Book, type Chapter, type Scene } from "@/lib/db";

function tiptapJsonToPlainParagraphs(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    const paras: string[] = [];
    const walk = (node: any) => {
      if (node.type === "paragraph") {
        const text = (node.content || []).map((c: any) => c.text || "").join("");
        paras.push(text);
      } else if (node.content) {
        node.content.forEach(walk);
      }
    };
    if (parsed.content) parsed.content.forEach(walk);
    return paras;
  } catch {
    return [""];
  }
}

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
    children.push(
      new Paragraph({
        text: chapter.title || `Chapter ${idx + 1}`,
        heading: HeadingLevel.HEADING_1,
      })
    );
    scenes.forEach((scene) => {
      const paras = tiptapJsonToPlainParagraphs(scene.content);
      paras.forEach((p) => {
        if (p.trim()) {
          children.push(
            new Paragraph({
              children: [new TextRun(p)],
              spacing: { after: 200 },
              indent: { firstLine: 480 },
            })
          );
        }
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

  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(book.title || "Untitled", pageWidth / 2, 200, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(12);
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
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    ensureSpace(30);
    doc.text(chapter.title || `Chapter ${idx + 1}`, marginX, y);
    y += 30;

    doc.setFont("times", "normal");
    doc.setFontSize(12);
    scenes.forEach((scene) => {
      const paras = tiptapJsonToPlainParagraphs(scene.content);
      paras.forEach((p) => {
        if (!p.trim()) return;
        const lines = doc.splitTextToSize("     " + p, maxWidth);
        lines.forEach((line: string) => {
          ensureSpace(18);
          doc.text(line, marginX, y);
          y += 18;
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
