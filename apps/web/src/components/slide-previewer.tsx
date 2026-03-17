import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { env } from "@slidelot/env/web";
import { trpc, queryClient } from "@/utils/trpc";
import { SlideTextEditor } from "./slide-text-editor";

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function renderSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  overlay: { text: string; xPercent: number; yPercent: number; fontScale: number },
) {
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);

  const text = overlay.text.trim();
  if (!text) return;

  const baseFontPx = H * 0.04;
  const fontSize = baseFontPx * overlay.fontScale;
  const lineHeight = fontSize * 1.6;
  const padX = fontSize * 0.5;
  const padY = fontSize * 0.25;
  const radius = fontSize * 0.35;

  ctx.font = `800 ${fontSize}px "Proxima Nova", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const maxWidth = W * 0.9;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth - padX * 2 && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const cx = W * (overlay.xPercent / 100);
  const totalH = lines.length * lineHeight;
  const startY = H * (overlay.yPercent / 100) - totalH / 2 + fontSize;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const y = startY + i * lineHeight;
    const m = ctx.measureText(line);
    const boxW = m.width + padX * 2;
    const boxH = lineHeight;
    const boxX = cx - boxW / 2;
    const boxY = y - fontSize - padY;

    const isFirst = i === 0;
    const isLast = i === lines.length - 1;
    const rTL = isFirst ? radius : 0;
    const rTR = isFirst ? radius : 0;
    const rBL = isLast ? radius : 0;
    const rBR = isLast ? radius : 0;

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, [rTL, rTR, rBR, rBL]);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.fillText(line, cx, y);
  }
}

async function renderAndDownload(
  cleanSlidePath: string,
  overlay: { text: string; xPercent: number; yPercent: number; fontScale: number },
  filename: string,
) {
  const img = await loadImage(`${env.VITE_SERVER_URL}/uploads/${cleanSlidePath}`);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  renderSlideToCanvas(ctx, img, overlay);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.92));
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function SlidePreviewer({
  slides,
  cleanSlides,
  postId,
  editable,
  slideTextOverlays,
  hookSlideTexts,
}: {
  slides: string[];
  cleanSlides?: string[] | null;
  postId: number;
  editable?: boolean;
  slideTextOverlays?: { text: string; xPercent: number; yPercent: number; fontScale: number }[] | null;
  hookSlideTexts?: string[] | null;
}) {
  const [current, setCurrent] = useState(0);
  const [savedOverlays, setSavedOverlays] = useState<
    Record<number, { text: string; xPercent: number; yPercent: number; fontScale: number }>
  >({});
  const [saveCounter, setSaveCounter] = useState(0);

  const updateSlideText = useMutation({
    ...trpc.posts.updateSlideText.mutationOptions(),
    onSuccess: (_data, variables) => {
      setSaveCounter((c) => c + 1);
      setSavedOverlays((prev) => ({
        ...prev,
        [variables.slideIndex]: {
          text: variables.text,
          xPercent: variables.xPercent,
          yPercent: variables.yPercent,
          fontScale: variables.fontScale ?? 1,
        },
      }));
      queryClient.invalidateQueries();
    },
  });

  const handleDownload = () => {
    const cleanPath = cleanSlides?.[current] ?? slides[current];
    if (!cleanPath) return;
    const overlay = getOverlay(current);
    renderAndDownload(cleanPath, overlay, `post-${postId}-slide-${current + 1}.jpg`);
  };

  const handleDownloadAll = () => {
    const sources = cleanSlides ?? slides;
    sources.forEach((path, i) => {
      if (!path) return;
      const overlay = getOverlay(i);
      renderAndDownload(path, overlay, `post-${postId}-slide-${i + 1}.jpg`);
    });
  };

  const getOverlay = (index: number) => {
    if (savedOverlays[index]) return savedOverlays[index];
    if (slideTextOverlays?.[index]) return slideTextOverlays[index];
    const fallbackText = hookSlideTexts?.[index] ?? "";
    return { text: fallbackText, xPercent: 50, yPercent: 30, fontScale: 1 };
  };

  const cleanSlideUrl = cleanSlides?.[current]
    ? `${env.VITE_SERVER_URL}/uploads/${cleanSlides[current]}`
    : undefined;

  const showEditor = editable && cleanSlideUrl;
  const overlay = getOverlay(current);

  return (
    <div className="space-y-3">
      {showEditor ? (
        <SlideTextEditor
          key={`${postId}-${current}`}
          cleanSlideUrl={cleanSlideUrl}
          initialText={overlay.text}
          initialXPercent={overlay.xPercent}
          initialYPercent={overlay.yPercent}
          initialFontScale={overlay.fontScale}
          isSaving={updateSlideText.isPending}
          savedKey={saveCounter}
          onSave={(text, xPercent, yPercent, fontScale) => {
            updateSlideText.mutate({
              postId,
              slideIndex: current,
              text,
              xPercent,
              yPercent,
              fontScale,
            });
          }}
        />
      ) : (
        <div className="relative aspect-[2/3] max-w-[300px] mx-auto rounded-lg overflow-hidden bg-muted">
          <img
            src={`${env.VITE_SERVER_URL}/uploads/${slides[current]}`}
            alt={`Slide ${current + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex justify-center gap-4">
        <button
          onClick={() => setCurrent((p) => Math.max(0, p - 1))}
          disabled={current === 0}
          className="text-sm px-3 py-1 rounded border disabled:opacity-30"
        >
          Prev
        </button>
        <div className="flex gap-1.5 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrent((p) => Math.min(slides.length - 1, p + 1))}
          disabled={current === slides.length - 1}
          className="text-sm px-3 py-1 rounded border disabled:opacity-30"
        >
          Next
        </button>
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={handleDownload}
          className="text-xs px-3 py-1.5 rounded border hover:bg-muted transition-colors"
        >
          Download Slide
        </button>
        <button
          onClick={handleDownloadAll}
          className="text-xs px-3 py-1.5 rounded border hover:bg-muted transition-colors"
        >
          Download All
        </button>
      </div>
    </div>
  );
}
