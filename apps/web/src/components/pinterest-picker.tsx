import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

interface SlideStep {
  hookId: number;
  slideIndex: number;
}

interface PinterestPickerProps {
  hookIds: number[];
  slideCount: number;
  open: boolean;
  onConfirm: (selections: { hookId: number; imageUrls: string[] }[]) => void;
  onCancel: () => void;
}

export function PinterestPicker({
  hookIds,
  slideCount,
  open,
  onConfirm,
  onCancel,
}: PinterestPickerProps) {
  const steps: SlideStep[] = hookIds.flatMap((hookId) =>
    Array.from({ length: slideCount }, (_, i) => ({ hookId, slideIndex: i }))
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [searchInput, setSearchInput] = useState("");
  const [activeCustomQuery, setActiveCustomQuery] = useState<Map<string, string>>(new Map());

  const step = steps[currentStep];
  const stepKey = step ? `${step.hookId}-${step.slideIndex}` : "";
  const customQuery = activeCustomQuery.get(stepKey);

  const aiSearchQuery = useQuery({
    ...trpc.pinterest.search.queryOptions({
      hookId: step?.hookId ?? 0,
      slideIndex: step?.slideIndex ?? 0,
    }),
    enabled: !!step && !customQuery,
  });

  const customSearchQuery = useQuery({
    ...trpc.pinterest.searchCustom.queryOptions({ query: customQuery ?? "" }),
    enabled: !!customQuery,
  });

  const activeQuery = customQuery ? customSearchQuery : aiSearchQuery;
  const pins = activeQuery.data?.pins ?? [];
  const displayedQuery = activeQuery.data?.query ?? "";
  const isLoading = activeQuery.isLoading;

  const inputValue = searchInput || displayedQuery;
  const currentSelection = selections.get(stepKey);

  function selectPin(imageUrl: string) {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.get(stepKey) === imageUrl) {
        next.delete(stepKey);
      } else {
        next.set(stepKey, imageUrl);
      }
      return next;
    });
  }

  function handleCustomSearch() {
    if (!searchInput.trim()) return;
    setActiveCustomQuery((prev) => new Map(prev).set(stepKey, searchInput));
  }

  function handleConfirm() {
    const grouped = new Map<number, string[]>();
    for (const s of steps) {
      const key = `${s.hookId}-${s.slideIndex}`;
      const url = selections.get(key);
      if (url) {
        const arr = grouped.get(s.hookId) ?? [];
        arr.push(url);
        grouped.set(s.hookId, arr);
      }
    }

    const result = Array.from(grouped.entries()).map(([hookId, imageUrls]) => ({
      hookId,
      imageUrls,
    }));

    onConfirm(result);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) onCancel();
  }

  function goTo(nextStep: number) {
    setCurrentStep(nextStep);
    setSearchInput("");
  }

  const totalSelected = new Set(
    Array.from(selections.keys()).map((k) => k.split("-")[0])
  ).size;

  const hookIndex = step ? hookIds.indexOf(step.hookId) + 1 : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Hook {hookIndex}/{hookIds.length}, Slide {(step?.slideIndex ?? 0) + 1}/{slideCount}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Search Pinterest..."
            value={inputValue}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => { if (!searchInput && inputValue) setSearchInput(inputValue); }}
            onKeyDown={(e) => e.key === "Enter" && handleCustomSearch()}
          />
          <Button size="sm" onClick={handleCustomSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pins.map((pin) => {
                const isSelected = currentSelection === pin.imageUrl;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => selectPin(pin.imageUrl)}
                    className={`relative aspect-[2/3] overflow-hidden rounded-sm border-2 transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    <img
                      src={pin.thumbnailUrl || pin.imageUrl}
                      alt={pin.description}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {step && (
          <div className="flex gap-1.5 items-center pt-2 border-t overflow-x-auto">
            {steps.map((s, i) => {
              const key = `${s.hookId}-${s.slideIndex}`;
              const url = selections.get(key);
              const isCurrent = i === currentStep;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`relative shrink-0 w-12 h-18 rounded-sm overflow-hidden border-2 flex items-center justify-center ${
                    isCurrent
                      ? "border-primary"
                      : url
                        ? "border-green-500"
                        : "border-muted bg-muted"
                  }`}
                >
                  {url ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{s.slideIndex + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <div className="flex gap-2 w-full justify-between">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={() => goTo(currentStep - 1)}>
                  Back
                </Button>
              )}
              {currentStep < steps.length - 1 && (
                <Button variant="outline" size="sm" onClick={() => goTo(currentStep + 1)}>
                  Next Slide
                </Button>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={totalSelected === 0}
            >
              Confirm & Generate ({totalSelected})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
