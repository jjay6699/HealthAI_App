import { createWorker, PSM } from "tesseract.js";

export interface StructuredImageText {
  text: string;
  lines: string[];
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

export async function extractStructuredTextFromImage(
  base64Image: string,
  mimeType: string
): Promise<StructuredImageText> {
  const worker = await getWorker();
  const result = await worker.recognize(`data:${mimeType};base64,${base64Image}`);
  const rawLines =
    result.data.blocks?.flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.map((line) => normalizeLine(line.text))
      )
    ).filter(Boolean) || [];

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
