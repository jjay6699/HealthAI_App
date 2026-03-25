import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite will replace this with the URL string to the worker at build time
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdf.js worker so it can run in the browser bundle
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export interface PdfTextPage {
  pageNumber: number;
  text: string;
  rows?: Array<{
    y: number;
    text: string;
    tokens: Array<{
      text: string;
      x: number;
      y: number;
    }>;
  }>;
}

/**
 * Converts a PDF file to images (one per page)
 * Returns an array of base64 encoded images
 */
export async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const images: string[] = [];
  
  // Process each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    
    // Set scale for better quality
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    } as any).promise;

    // Convert canvas to base64 image
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    // Remove the data URL prefix
    const base64 = imageData.split(',')[1];
    images.push(base64);
  }
  
  return images;
}

/**
 * Extracts text content from a PDF file
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  // Extract text from each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
}

export async function extractStructuredTextPagesFromPdf(file: File): Promise<PdfTextPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PdfTextPage[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = (textContent.items as any[])
      .map((item) => ({
        text: String(item.str || "").trim(),
        x: Array.isArray(item.transform) ? Number(item.transform[4] || 0) : 0,
        y: Array.isArray(item.transform) ? Number(item.transform[5] || 0) : 0
      }))
      .filter((item) => item.text);

    items.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
      return a.x - b.x;
    });

    const lines: Array<{ y: number; parts: typeof items }> = [];
    for (const item of items) {
      const existingLine = lines.find((line) => Math.abs(line.y - item.y) <= 2.5);
      if (existingLine) {
        existingLine.parts.push(item);
      } else {
        lines.push({ y: item.y, parts: [item] });
      }
    }

    const pageText = lines
      .sort((a, b) => b.y - a.y)
      .map((line) =>
        line.parts
          .sort((a, b) => a.x - b.x)
          .map((part) => part.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean)
      .join("\n");

    pages.push({
      pageNumber: pageNum,
      text: pageText,
      rows: lines
        .sort((a, b) => b.y - a.y)
        .map((line) => {
          const tokens = line.parts.sort((a, b) => a.x - b.x);
          return {
            y: line.y,
            text: tokens
              .map((part) => part.text)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim(),
            tokens
          };
        })
        .filter((row) => Boolean(row.text))
    });
  }

  return pages;
}
