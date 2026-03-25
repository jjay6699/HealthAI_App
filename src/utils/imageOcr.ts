import { createWorker, PSM } from "tesseract.js";

export interface StructuredImageText {
  text: string;
  lines: string[];
}

interface OcrWord {
  text: string;
  x: number;
  y: number;
}

let workerPromise: Promise<Tesseract.Worker> | null = null;

const getWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1"
      });
      return worker;
    })();
  }

  return workerPromise;
};

const normalizeLine = (line: string) =>
  line
    .replace(/\s+/g, " ")
    .replace(/[|]/g, " ")
    .trim();

const buildLinesFromWords = (words: OcrWord[]) => {
  if (words.length === 0) {
    return [] as string[];
  }

  const sortedWords = [...words].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
    return a.x - b.x;
  });

  const rows: Array<{ y: number; parts: OcrWord[] }> = [];
  for (const word of sortedWords) {
    const existingRow = rows.find((row) => Math.abs(row.y - word.y) <= 10);
    if (existingRow) {
      existingRow.parts.push(word);
      existingRow.y = (existingRow.y * (existingRow.parts.length - 1) + word.y) / existingRow.parts.length;
    } else {
      rows.push({ y: word.y, parts: [word] });
    }
  }

  return rows
    .sort((a, b) => a.y - b.y)
    .map((row) =>
      normalizeLine(
        row.parts
          .sort((a, b) => a.x - b.x)
          .map((part) => part.text)
          .join(" ")
      )
    )
    .filter(Boolean);
};

export async function extractStructuredTextFromImage(
  base64Image: string,
  mimeType: string
): Promise<StructuredImageText> {
  const worker = await getWorker();
  const result = await worker.recognize(`data:${mimeType};base64,${base64Image}`);
  const pageData = result.data as any;
  const rawWords =
    (pageData.words || [])
      .map((word: any) => ({
        text: normalizeLine(String(word.text || "")),
        x: Number(word.bbox?.x0 || 0),
        y: Number(word.bbox?.y0 || 0)
      }))
      .filter((word: OcrWord) => word.text) || [];

  const positionedLines = buildLinesFromWords(rawWords);
  const paragraphLines =
    pageData.blocks?.flatMap((block: any) =>
      block.paragraphs.flatMap((paragraph: any) =>
        paragraph.lines.map((line: any) => normalizeLine(line.text))
      )
    ).filter(Boolean) || [];
  const rawLines = [...positionedLines, ...paragraphLines];

  const lines: string[] = [];
  const seen = new Set<string>();
  for (const line of rawLines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }

  return {
    text: lines.join("\n"),
    lines
  };
}
