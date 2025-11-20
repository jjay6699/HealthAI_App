import * as pdfjsLib from 'pdfjs-dist';

// Use the default pdfjs-dist worker setup bundled by Vite (no external CDN).

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

