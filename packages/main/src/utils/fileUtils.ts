import { promises as fs } from "fs";
import { getResolvedPDFJS, getDocumentProxy } from "unpdf";

/**
 * Reads and returns the content of a text file.
 */
export async function extractTxtContent(filePath: string): Promise<string> {
  if (!filePath.endsWith(".txt")) throw new Error("File must be a .txt file");
  return fs.readFile(filePath, "utf8");
}

/**
 * Extracts and returns the text content from a PDF file using unpdf.
 */
export async function extractPdfContent(filePath: string): Promise<string> {
  if (!filePath.endsWith(".pdf")) throw new Error("File must be a .pdf file");
  const buffer = await fs.readFile(filePath);
  const pdfjs = await getResolvedPDFJS();
  const doc = await getDocumentProxy(buffer, pdfjs);
  const numPages = doc.numPages;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    pageTexts.push(await processPdfPage(doc, pageNum));
  }
  return pageTexts.join("\n\n");
}

async function processPdfPage(
  doc: any,
  pageNum: number,
  threshold: number = 2
): Promise<string> {
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent();

  let currentLine = '';
  let currentY: number | null = null;
  const lines: string[] = [];

  const { items } = textContent;
  if (items.length === 0) return '';

  items.forEach((item: any) => {
    if (!('str' in item)) return;
    const { str } = item;
    const y = item.transform[5];
    if (currentLine === '') {
      currentLine = str;
      currentY = y;
    } else {
      const yDiff = Math.abs(y - (currentY || 0));
      if (yDiff > threshold) {
        lines.push(currentLine.trim());
        currentLine = str;
        currentY = y;
      } else {
        currentLine = [currentLine, str].filter(Boolean).join(' ');
      }
    }
  });
  if (currentLine !== '') lines.push(currentLine.trim());
  return lines.join('\n');
}

// Add more file-related utility functions here as needed.
