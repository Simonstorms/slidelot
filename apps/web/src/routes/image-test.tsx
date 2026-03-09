import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ImageIcon, Sparkles, Grid3x3, Trash2 } from "lucide-react";

export const Route = createFileRoute("/image-test")({
  component: ImageTestPage,
});

function ImageTestPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"hooks" | "custom">("hooks");

  const modelsQuery = useQuery(trpc.imageTest.models.queryOptions());
  const stylesQuery = useQuery(trpc.imageTest.promptStyles.queryOptions());
  const hooksQuery = useQuery(trpc.imageTest.hooks.queryOptions());

  const hasPendingRef = useRef(false);
  const resultsQuery = useQuery({
    ...trpc.imageTest.list.queryOptions(),
    refetchInterval: hasPendingRef.current ? 2000 : false,
  });
  hasPendingRef.current = (resultsQuery.data ?? []).some(
    (r) => r.status === "pending" || r.status === "generating"
  );

  const models = modelsQuery.data ?? [];
  const styles = stylesQuery.data ?? [];
  const hooksList = hooksQuery.data ?? [];
  const savedResults = resultsQuery.data ?? [];

  const matrixMutation = useMutation({
    ...trpc.imageTest.generateMatrix.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.imageTest.list.queryKey(),
      });
    },
  });

  const customMutation = useMutation({
    ...trpc.imageTest.generateMultiple.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.imageTest.list.queryKey(),
      });
    },
  });

  const deleteMutation = useMutation({
    ...trpc.imageTest.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.imageTest.list.queryKey(),
      });
    },
  });

  const clearMutation = useMutation({
    ...trpc.imageTest.clearAll.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.imageTest.list.queryKey(),
      });
    },
  });

  function toggleModel(id: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleStyle(id: string) {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleHookGenerate(sceneDescription: string, hookId: number) {
    if (selectedModels.size === 0 || selectedStyles.size === 0) return;
    matrixMutation.mutate({
      sceneDescription,
      models: Array.from(selectedModels),
      styleIds: Array.from(selectedStyles),
      hookId,
    });
  }

  function handleCustomGenerate() {
    if (!prompt.trim() || selectedModels.size === 0) return;
    customMutation.mutate({
      prompt: prompt.trim(),
      models: Array.from(selectedModels),
    });
  }

  const pendingCount = savedResults.filter(
    (r) => r.status === "pending" || r.status === "generating"
  ).length;
  const completedResults = savedResults.filter(
    (r) => r.status === "completed" || r.status === "failed"
  );

  const styleGroups = new Map<string, typeof savedResults>();
  const ungrouped: typeof savedResults = [];
  for (const r of savedResults) {
    if (r.style) {
      const label = styles.find((s) => s.id === r.style)?.label ?? r.style;
      if (!styleGroups.has(label)) styleGroups.set(label, []);
      styleGroups.get(label)!.push(r);
    } else {
      ungrouped.push(r);
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Image Test Lab</h1>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Models</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedModels(new Set(models.map((m) => m.id)))
                }
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedModels(new Set())}
              >
                None
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {models.map((m) => (
                <Button
                  key={m.id}
                  variant={selectedModels.has(m.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleModel(m.id)}
                >
                  {m.label}
                  <span className="ml-1.5 text-xs opacity-60">{m.cost}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Prompt Styles</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedStyles(new Set(styles.map((s) => s.id)))
                }
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStyles(new Set())}
              >
                None
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {styles.map((s) => (
                <Button
                  key={s.id}
                  variant={selectedStyles.has(s.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStyle(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {selectedModels.size > 0 && selectedStyles.size > 0 && (
            <p className="text-xs text-muted-foreground">
              Each hook will generate {selectedModels.size} x{" "}
              {selectedStyles.size} ={" "}
              {selectedModels.size * selectedStyles.size} images
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b">
        {(
          [
            { key: "hooks", label: "From Hooks" },
            { key: "custom", label: "Custom Prompt" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "hooks" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick a hook to generate images across all selected models and prompt
            styles. Runs in the background.
          </p>
          {hooksList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hooks with scene descriptions yet. Generate some hooks first.
            </p>
          ) : (
            <div className="space-y-2">
              {hooksList.map((hook) => (
                <Card key={hook.id}>
                  <CardContent className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{hook.text}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {hook.sceneDescriptions?.join(" | ")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {hook.sceneDescriptions?.map((scene, idx) => (
                        <Button
                          key={idx}
                          size="sm"
                          variant="outline"
                          disabled={
                            selectedModels.size === 0 ||
                            selectedStyles.size === 0
                          }
                          onClick={() => handleHookGenerate(scene, hook.id)}
                        >
                          Slide {idx + 1}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "custom" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Custom Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <Button
              onClick={handleCustomGenerate}
              disabled={!prompt.trim() || selectedModels.size === 0}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Generate ({selectedModels.size}{" "}
              {selectedModels.size === 1 ? "model" : "models"})
            </Button>
          </CardContent>
        </Card>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingCount} image{pendingCount > 1 ? "s" : ""} generating in
          background...
        </div>
      )}

      {savedResults.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Results ({completedResults.length}
              {pendingCount > 0 ? ` + ${pendingCount} pending` : ""})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              Clear All
            </Button>
          </div>

          {Array.from(styleGroups.entries()).map(([styleLabel, items]) => (
            <div key={styleLabel} className="space-y-3">
              <h3 className="text-sm font-medium">{styleLabel}</h3>
              <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 whitespace-pre-wrap">
                {items[0]?.prompt}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {items.map((r) => (
                  <div key={r.id} className="space-y-1.5 group relative">
                    <p className="text-xs font-medium truncate">{r.model}</p>
                    {r.status === "pending" || r.status === "generating" ? (
                      <div className="aspect-[2/3] rounded-lg bg-muted flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : r.error ? (
                      <div className="aspect-[2/3] rounded-lg bg-destructive/10 flex items-center justify-center p-3">
                        <p className="text-xs text-destructive text-center">
                          {r.error}
                        </p>
                      </div>
                    ) : r.imageUrl ? (
                      <div className="relative">
                        <a
                          href={r.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={r.imageUrl}
                            alt={`${r.model} ${styleLabel}`}
                            className="w-full aspect-[2/3] object-cover rounded-lg"
                          />
                        </a>
                        <button
                          onClick={() => deleteMutation.mutate({ id: r.id })}
                          className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {ungrouped.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Custom</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ungrouped.map((r) => (
                  <Card key={r.id} className="group relative">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {r.model}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {r.prompt}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {r.status === "pending" || r.status === "generating" ? (
                        <div className="aspect-[2/3] rounded-lg bg-muted flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : r.error ? (
                        <div className="aspect-[2/3] rounded-lg bg-destructive/10 flex items-center justify-center p-4">
                          <p className="text-sm text-destructive text-center">
                            {r.error}
                          </p>
                        </div>
                      ) : r.imageUrl ? (
                        <div className="relative">
                          <a
                            href={r.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={r.imageUrl}
                              alt={`${r.model} result`}
                              className="w-full aspect-[2/3] object-cover rounded-lg"
                            />
                          </a>
                          <button
                            onClick={() =>
                              deleteMutation.mutate({ id: r.id })
                            }
                            className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
