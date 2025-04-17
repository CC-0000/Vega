import { promises as fs } from "fs";
import { getResolvedPDFJS } from "unpdf";
import { OfficeParserConfig, parseOfficeAsync } from "officeparser";

/**
 * Reads and returns the content of a text file.
 *
 * @param filePath - Path to the text file to read
 * @returns Promise that resolves to the text content of the file as a string
 * @throws Error if the file is not a .txt file or if there's an issue accessing the file
 */
export async function extractTxtContent(filePath: string): Promise<string> {
  if (!filePath.endsWith(".txt")) throw new Error("File must be a .txt file");
  return fs.readFile(filePath, "utf8");
}

/**
 * Processes a single PDF page and extracts text content.
 *
 * This function extracts text from a PDF page while preserving line breaks based on
 * the vertical positioning of text elements. Text items that are within the threshold
 * distance of each other vertically are considered to be on the same line.
 *
 * @param doc - The PDF document proxy object from unpdf
 * @param pageNum - The page number to process (1-based index)
 * @param threshold - The vertical distance threshold to determine line breaks (default: 2)
 * @returns A string containing the extracted text with line breaks preserved
 */
async function extractPdfPage(
  doc: any,
  pageNum: number,
  threshold: number = 2
): Promise<string> {
  // Get the page object and extract text content
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent();

  let currentLine = "";
  let currentY: number | null = null;
  const lines: string[] = [];

  const { items } = textContent;
  if (items.length === 0) return "";

  items.forEach((item: any) => {
    if (!("str" in item)) return; // Skip TextMarkedContent items

    const { str } = item;
    const y = item.transform[5];

    if (currentLine === "") {
      currentLine = str;
      currentY = y;
    } else {
      // Calculate vertical distance between current item and previous line
      const yDiff = Math.abs(y - (currentY || 0));

      // If vertical distance exceeds threshold, start a new line
      if (yDiff > threshold) {
        lines.push(currentLine.trim());
        currentLine = str;
        currentY = y;
      } else {
        // Append to current line with space
        currentLine = [currentLine, str].filter(Boolean).join(" ");
      }
    }
  });

  // Add the last line if it exists
  if (currentLine !== "") lines.push(currentLine.trim());

  // Join all lines with newline characters
  return lines.join("\n");
}

/**
 * Extracts and returns the text content from a PDF file using unpdf.
 *
 * @param filePath - Path to the PDF file to extract text from
 * @returns Promise that resolves to an array of strings, where each string represents the text content of a page
 * @throws Error if the file is not a PDF or if there's an issue accessing the file
 */
export async function extractPdfContent(filePath: string): Promise<string[]> {
  const pageTexts: string[] = [];
  if (!filePath.toLowerCase().endsWith(".pdf"))
    throw new Error("File must be a .pdf file");

  try {
    // Read the file as a buffer
    const pdfBuffer = await fs.readFile(filePath);
    // Get access to the PDF.js API
    const { getDocument } = await getResolvedPDFJS();
    // Load the document
    const doc = await getDocument(new Uint8Array(pdfBuffer)).promise;
    // Process all pages in parallel
    const pagePromises = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      pagePromises.push(extractPdfPage(doc, i));
    }
    // Wait for all pages to be processed
    return Promise.all(pagePromises);
  } catch (error) {
    console.error("Error during PDF extraction with unpdf:", error);
    return pageTexts;
  }
}

/**
 * Extracts text content from a specific page of a PDF document.
 *
 * @param filePath - Path to the PDF file (used for error reporting)
 * @param pageNum - The page number to extract (1-based index)
 * @param pdfBuffer - Buffer containing the PDF data
 * @returns Promise that resolves to the extracted text content as a string
 * @throws Error if the page number is invalid or if there's an issue processing the PDF
 */
export async function extractPdfContentSinglePage(
  filePath: string,
  pageNum: number,
  pdfBuffer: Buffer<ArrayBufferLike>
): Promise<string> {
  if (pageNum < 1) return "";
  try {
    const { getDocument } = await getResolvedPDFJS();
    const doc = await getDocument(new Uint8Array(pdfBuffer)).promise;
    if (pageNum > doc.numPages) {
      throw new Error(
        `Page ${pageNum} is out of bounds. Document has ${doc.numPages} pages.`
      );
    }
    return extractPdfPage(doc, pageNum);
  } catch (error) {
    throw new Error(
      `Error extracting page ${pageNum} from ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Add more file-related utility functions here as needed.
/**
 * Extracts text content from an Office document (e.g., .docx, .pptx, .xlsx, .odt, .odp, .ods).
 *
 * @param filePath - Path to the Office document file
 * @returns Promise that resolves to the extracted text content as a string
 * @throws Error if the file is not an Office document or if there's an issue processing the file
 */
export async function extractTextFromOfficeFile(
  filePath: string
): Promise<string> {
  const config: OfficeParserConfig = {
    newlineDelimiter: "\n",
    ignoreNotes: false,
  };

  const text = await parseOfficeAsync(filePath, config);
  return text;
}
