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
  const fontSize = Math.round(height * 0.045 * fontScale);
  const x = Math.round(width * (xPercent / 100));
  const startY = Math.round(height * (yPercent / 100));
  const maxY = Math.round(height * 0.9);
  const lineHeight = Math.round(fontSize * 1.5);
  const fontFamily = "'Proxima Nova', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const wordCount = test.split(/\s+/).length;
    if (wordCount > 3 && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const padX = Math.round(fontSize * 0.5);
  const padY = Math.round(fontSize * 0.25);
  const borderRadius = Math.round(fontSize * 0.35);
  const charWidth = fontSize * 0.58;
  const boxGap = Math.round(fontSize * 0.08);

  const visibleLines = lines.filter((_, i) => startY + i * lineHeight <= maxY);

  const boxes = visibleLines.map((line, i) => {
    const y = startY + i * lineHeight;
    const boxW = Math.round(line.length * charWidth + padX * 2);
    const boxH = lineHeight + padY * 2 - boxGap;
    const boxX = Math.round(x - boxW / 2);
    const boxY = Math.round(y - fontSize * 0.8 - padY);
    return { line, y, boxW, boxH, boxX, boxY };
  });

  let elements = "";
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const prev = boxes[i - 1];
    const next = boxes[i + 1];
    const rTop = !prev ? borderRadius : 0;
    const rBottom = !next ? borderRadius : 0;

    if (rTop === 0 && rBottom === 0) {
      elements += `<rect x="${b.boxX}" y="${b.boxY}" width="${b.boxW}" height="${b.boxH}" fill="white"/>`;
    } else {
      const r1 = rTop, r2 = rTop, r3 = rBottom, r4 = rBottom;
      elements += `<path d="M${b.boxX + r1},${b.boxY} h${b.boxW - r1 - r2} ${r2 > 0 ? `a${r2},${r2} 0 0 1 ${r2},${r2}` : `l${r2},0`} v${b.boxH - r2 - r3} ${r3 > 0 ? `a${r3},${r3} 0 0 1 -${r3},${r3}` : `l0,${r3}`} h-${b.boxW - r3 - r4} ${r4 > 0 ? `a${r4},${r4} 0 0 1 -${r4},-${r4}` : `l0,-${r4}`} v-${b.boxH - r4 - r1} ${r1 > 0 ? `a${r1},${r1} 0 0 1 ${r1},-${r1}` : `l0,-${r1}`} Z" fill="white"/>`;
    }

    if (prev) {
      const overlapY = b.boxY;
      const left = Math.max(b.boxX, prev.boxX);
      const right = Math.min(b.boxX + b.boxW, prev.boxX + prev.boxW);
      if (right > left) {
        const h = Math.round(fontSize * 0.15);
        elements += `<rect x="${left}" y="${overlapY - h}" width="${right - left}" height="${h * 2}" fill="white"/>`;
      }
    }

    elements += `<text x="${x}" y="${b.y}" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize}" font-weight="800" fill="black">${escapeXml(b.line)}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${elements}</svg>`;

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
