import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { env } from "@slidelot/env/web";
import { trpc, queryClient } from "@/utils/trpc";
import { SlideTextEditor } from "./slide-text-editor";

function downloadSlide(slidePath: string, filename: string) {
  const url = `${env.VITE_SERVER_URL}/uploads/${slidePath}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
    const path = cleanSlides?.[current] ?? slides[current];
    if (path) downloadSlide(path, `post-${postId}-slide-${current + 1}.webp`);
  };

  const handleDownloadAll = () => {
    const sources = cleanSlides ?? slides;
    sources.forEach((path, i) => {
      if (path) downloadSlide(path, `post-${postId}-slide-${i + 1}.webp`);
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
