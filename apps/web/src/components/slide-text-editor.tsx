import { useState, useRef, useCallback } from "react";
import Moveable from "react-moveable";
import { Save, Loader2 } from "lucide-react";

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

export function SlideTextEditor({
  cleanSlideUrl,
  initialText,
  initialXPercent = 50,
  initialYPercent = 30,
  initialFontScale = 1,
  onSave,
  isSaving,
  savedKey = 0,
}: {
  cleanSlideUrl: string;
  initialText: string;
  initialXPercent?: number;
  initialYPercent?: number;
  initialFontScale?: number;
  onSave: (text: string, xPercent: number, yPercent: number, fontScale: number) => void;
  isSaving: boolean;
  savedKey?: number;
}) {
  const [xPercent, setXPercent] = useState(initialXPercent);
  const [yPercent, setYPercent] = useState(initialYPercent);
  const [fontScale, setFontScale] = useState(initialFontScale);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lastSavedKey, setLastSavedKey] = useState(savedKey);
  if (savedKey !== lastSavedKey) {
    setLastSavedKey(savedKey);
    setDirty(false);
  }

  const xRef = useRef(initialXPercent);
  const yRef = useRef(initialYPercent);
  const fontScaleRef = useRef(initialFontScale);
  const textRef = useRef(initialText);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const baseFontPx = () => {
    const h = containerRef.current?.offsetHeight ?? 450;
    return h * 0.04;
  };

  const spanRefCallback = useCallback(
    (el: HTMLSpanElement | null) => {
      spanRef.current = el;
      if (el && el.textContent === "") {
        el.textContent = initialText;
      }
    },
    [initialText],
  );

  const enterEditMode = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const span = spanRef.current;
      if (!span) return;
      span.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(span);
        sel.collapseToEnd();
      }
    });
  };

  const exitEditMode = () => {
    setEditing(false);
  };

  return (
    <div className="relative">
      <div
        ref={(el) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (el && !ready) setReady(true);
        }}
        className="relative aspect-[2/3] max-w-[300px] mx-auto rounded-lg overflow-hidden bg-muted"
      >
        <img
          src={cleanSlideUrl}
          alt="Slide background"
          className="w-full h-full object-cover pointer-events-none select-none"
          draggable={false}
        />
        {ready && (
          <>
            <div
              ref={targetRef}
              className="absolute text-center"
              onDoubleClick={() => {
                if (!editing) enterEditMode();
              }}
              style={{
                left: `${xPercent}%`,
                top: `${yPercent}%`,
                transform: "translate(-50%, -50%)",
                maxWidth: "90%",
                minWidth: "2em",
                lineHeight: 1.6,
                fontSize: `${baseFontPx() * fontScale}px`,
                cursor: editing ? "text" : "grab",
              }}
            >
              <span
                ref={spanRefCallback}
                contentEditable={editing}
                suppressContentEditableWarning
                onInput={(e) => {
                  textRef.current = e.currentTarget.textContent ?? "";
                  setDirty(true);
                }}
                onBlur={exitEditMode}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.currentTarget.blur();
                  }
                }}
                className={`font-extrabold inline ${
                  editing
                    ? "outline outline-2 outline-primary cursor-text"
                    : ""
                }`}
                style={{
                  color: "black",
                  backgroundColor: "white",
                  borderRadius: "0.35em",
                  padding: "0.25em 0.5em",
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                }}
              />
            </div>
            <Moveable
              target={targetRef}
              container={containerRef.current}
              draggable={!editing}
              resizable={!editing}
              snappable={false}
              origin={false}
              hideDefaultLines={false}
              renderDirections={["nw", "ne", "sw", "se"]}
              onDrag={({ target: t, left, top }) => {
                const c = containerRef.current;
                const target = t as HTMLElement;
                if (!c) return;
                const tw = target.offsetWidth;
                const th = target.offsetHeight;
                const cx = clamp(left + tw / 2, 0, c.offsetWidth);
                const cy = clamp(top + th / 2, 0, c.offsetHeight);
                xRef.current = (cx / c.offsetWidth) * 100;
                yRef.current = (cy / c.offsetHeight) * 100;
                target.style.left = `${xRef.current}%`;
                target.style.top = `${yRef.current}%`;
                target.style.transform = "translate(-50%, -50%)";
              }}
              onDragEnd={() => {
                setXPercent(xRef.current);
                setYPercent(yRef.current);
                setDirty(true);
              }}
              onResize={({ target: t, width, height, drag }) => {
                const c = containerRef.current;
                const target = t as HTMLElement;
                if (!c) return;
                const currentFontPx = baseFontPx() * fontScaleRef.current;
                if (currentFontPx <= 0) return;
                const ratio = height / target.offsetHeight;
                const newScale = fontScaleRef.current * ratio;
                const clamped = clamp(newScale, 0.3, 4);
                fontScaleRef.current = clamped;
                target.style.fontSize = `${baseFontPx() * clamped}px`;
                target.style.width = `${width}px`;
                const cx = clamp(drag.left + width / 2, 0, c.offsetWidth);
                const cy = clamp(drag.top + height / 2, 0, c.offsetHeight);
                xRef.current = (cx / c.offsetWidth) * 100;
                yRef.current = (cy / c.offsetHeight) * 100;
                target.style.left = `${xRef.current}%`;
                target.style.top = `${yRef.current}%`;
                target.style.transform = "translate(-50%, -50%)";
              }}
              onResizeEnd={() => {
                setFontScale(fontScaleRef.current);
                setXPercent(xRef.current);
                setYPercent(yRef.current);
                setDirty(true);
              }}
            />
          </>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-1">
        Double-click text to edit
      </p>
      {dirty && (
        <div className="flex justify-center mt-2">
          <button
            onClick={() => onSave(textRef.current, xPercent, yPercent, fontScale)}
            disabled={isSaving}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
