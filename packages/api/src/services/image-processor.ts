import sharp from "sharp";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

function buildTextOverlaySvg(
  text: string,
  width: number,
  height: number,
  xPercent = 50,
  yPercent = 30,
  fontScale = 1
): Buffer {
  const fontSize = Math.round(height * 0.04 * fontScale);
  const x = Math.round(width * (xPercent / 100));
  const startY = Math.round(height * (yPercent / 100));
  const maxY = Math.round(height * 0.9);
  const lineHeight = Math.round(fontSize * 1.35);

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const wordCount = test.split(/\s+/).length;
    if (wordCount > 5 && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const padX = Math.round(fontSize * 0.4);
  const padY = Math.round(fontSize * 0.2);
  const borderRadius = Math.round(fontSize * 0.25);

  const lineElements = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      if (y > maxY) return "";
      const charWidth = fontSize * 0.55;
      const boxW = Math.round(line.length * charWidth + padX * 2);
      const boxH = Math.round(fontSize + padY * 2);
      const boxX = Math.round(x - boxW / 2);
      const boxY = Math.round(y - fontSize * 0.8 - padY);
      return `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="${borderRadius}" ry="${borderRadius}" fill="rgba(0,0,0,0.75)"/><text x="${x}" y="${y}" text-anchor="middle" font-family="'Proxima Nova', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white">${escapeXml(line)}</text>`;
    })
    .filter(Boolean)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lineElements}</svg>`;

  return Buffer.from(svg);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function processAllSlides(
  rawPaths: string[],
  slideTexts: string[],
  postId: number,
  uploadsDir: string
): Promise<{ slides: string[]; cleanSlides: string[] }> {
  const outputDir = join(uploadsDir, "posts", String(postId));
  await mkdir(outputDir, { recursive: true });

  const slides: string[] = [];
  const cleanSlides: string[] = [];

  for (let i = 0; i < rawPaths.length; i++) {
    const rawPath = rawPaths[i];
    if (!rawPath) continue;

    const meta = await sharp(rawPath).metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1536;

    const cleanPath = join(outputDir, `slide-${i + 1}-clean.webp`);
    await sharp(rawPath).webp({ quality: 90 }).toFile(cleanPath);
    cleanSlides.push(`posts/${postId}/slide-${i + 1}-clean.webp`);

    const text = slideTexts[i] ?? "";
    if (text) {
      const svg = buildTextOverlaySvg(text, width, height);
      const overlayPath = join(outputDir, `slide-${i + 1}.webp`);
      const svgRendered = await sharp(svg, { density: 72 })
        .resize(width, height)
        .png()
        .toBuffer();
      await sharp(rawPath)
        .composite([{ input: svgRendered, top: 0, left: 0 }])
        .webp({ quality: 90 })
        .toFile(overlayPath);
      slides.push(`posts/${postId}/slide-${i + 1}.webp`);
    } else {
      slides.push(`posts/${postId}/slide-${i + 1}-clean.webp`);
    }
  }

  return { slides, cleanSlides };
}

export async function reprocessSingleSlide(
  cleanSlidePath: string,
  outputPath: string,
  text: string,
  xPercent: number,
  yPercent: number,
  fontScale = 1
): Promise<void> {
  const meta = await sharp(cleanSlidePath).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1536;

  if (!text.trim()) {
    await sharp(cleanSlidePath).webp({ quality: 90 }).toFile(outputPath);
    return;
  }

  const svg = buildTextOverlaySvg(text, width, height, xPercent, yPercent, fontScale);
  const svgRendered = await sharp(svg, { density: 72 })
    .resize(width, height)
    .png()
    .toBuffer();

  await sharp(cleanSlidePath)
    .composite([{ input: svgRendered, top: 0, left: 0 }])
    .webp({ quality: 90 })
    .toFile(outputPath);
}
