import { useState } from "react";
import { env } from "@marketing-ai/env/web";

export function SlidePreviewer({
  slides,
  postId,
}: {
  slides: string[];
  postId: number;
}) {
  const [current, setCurrent] = useState(0);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[2/3] max-w-[300px] mx-auto rounded-lg overflow-hidden bg-muted">
        <img
          src={`${env.VITE_SERVER_URL}/uploads/${slides[current]}`}
          alt={`Slide ${current + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

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
    </div>
  );
}
