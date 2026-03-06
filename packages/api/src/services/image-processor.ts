import sharp from "sharp";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

function wrapText(text: string, maxWordsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (
      currentLine &&
      currentLine.split(" ").length >= maxWordsPerLine
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function addTextOverlay(
  imagePath: string,
  text: string,
  outputPath: string
): Promise<string> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1536;

  const fontSize = Math.round(height * 0.065);
  const strokeWidth = Math.round(fontSize * 0.15);
  const lineHeight = fontSize * 1.3;
  const yOffset = Math.round(height * 0.3);
  const maxWordsPerLine = 5;

  const lines = wrapText(text, maxWordsPerLine);
  const totalTextHeight = lines.length * lineHeight;
  const startY = yOffset - totalTextHeight / 2;

  const textElements = lines
    .map((line, i) => {
      const y = startY + i * lineHeight + fontSize;
      const escaped = escapeXml(line);
      return `<text x="50%" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}" fill="white" stroke="black" stroke-width="${strokeWidth}" paint-order="stroke">${escaped}</text>`;
    })
    .join("\n");

  const svgOverlay = `<svg width="${width}" height="${height}">
${textElements}
</svg>`;

  await image
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .webp({ quality: 90 })
    .toFile(outputPath);

  return outputPath;
}

export async function processAllSlides(
  rawPaths: string[],
  slideTexts: string[],
  postId: number,
  uploadsDir: string
): Promise<string[]> {
  const outputDir = join(uploadsDir, "posts", String(postId));
  await mkdir(outputDir, { recursive: true });

  const results: string[] = [];

  for (let i = 0; i < rawPaths.length; i++) {
    const rawPath = rawPaths[i];
    const slideText = slideTexts[i];
    if (!rawPath || !slideText) continue;
    const outputPath = join(outputDir, `slide-${i + 1}.webp`);
    await addTextOverlay(rawPath, slideText, outputPath);
    results.push(`posts/${postId}/slide-${i + 1}.webp`);
  }

  return results;
}
