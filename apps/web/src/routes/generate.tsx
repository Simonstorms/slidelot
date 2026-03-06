import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HookCard } from "@/components/hook-card";
import { GenerationProgress } from "@/components/generation-progress";

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
});

type GeneratedHook = {
  id: number;
  text: string;
  formula: string | null;
  score: number | null;
  status: string;
  slideTexts: string[] | null;
};

function GeneratePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [count, setCount] = useState(5);
  const [hooks, setHooks] = useState<GeneratedHook[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [jobIds, setJobIds] = useState<number[]>([]);

  const generateMutation = useMutation({
    ...trpc.hooks.generate.mutationOptions(),
    onSuccess: (data) => {
      setHooks(data);
      setSelectedIds(new Set(data.map((h) => h.id)));
      setStep(2);
      queryClient.invalidateQueries();
    },
  });

  const createSlidesMutation = useMutation({
    ...trpc.generation.createSlides.mutationOptions(),
    onSuccess: (data) => {
      setJobIds(data.jobIds);
      setStep(3);
      queryClient.invalidateQueries();
    },
  });

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Generate Content</h1>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Generate Hooks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Claude will generate hooks using your product settings and learned
              formulas, then recursively improve them until they score 7.5+/10.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm">Count:</span>
              {[5, 10, 15].map((n) => (
                <Button
                  key={n}
                  variant={count === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Button
              onClick={() => generateMutation.mutate({ count })}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? "Generating & Scoring..."
                : "Generate Hooks"}
            </Button>
            {generateMutation.isPending && (
              <p className="text-sm text-muted-foreground animate-pulse">
                This may take a minute — generating, scoring, and improving
                hooks...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Select Hooks for Slideshows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedIds(new Set(hooks.map((h) => h.id)))
                }
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Select None
              </Button>
              <span className="text-sm text-muted-foreground self-center ml-2">
                {selectedIds.size}/{hooks.length} selected
              </span>
            </div>

            <div className="space-y-3">
              {hooks.map((hook) => (
                <HookCard
                  key={hook.id}
                  hook={hook}
                  selectable
                  selected={selectedIds.has(hook.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() =>
                  createSlidesMutation.mutate({
                    hookIds: Array.from(selectedIds),
                  })
                }
                disabled={
                  selectedIds.size === 0 || createSlidesMutation.isPending
                }
              >
                {createSlidesMutation.isPending
                  ? "Starting..."
                  : `Create Slides (${selectedIds.size})`}
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Generating Slides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <GenerationProgress jobIds={jobIds} />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Generate More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
