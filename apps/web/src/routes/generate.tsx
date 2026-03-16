import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HookCard } from "@/components/hook-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, ImagePlus, Trash2, Camera, Image } from "lucide-react";
import { PinterestPicker } from "@/components/pinterest-picker";

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
});

function GeneratePage() {
  const [count, setCount] = useState(3);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [imageMode, setImageMode] = useState<"ai" | "pinterest">("ai");
  const [pinterestPickerOpen, setPinterestPickerOpen] = useState(false);

  const activeHookJobsQuery = useQuery({
    ...trpc.bgJobs.active.queryOptions({ type: "hook_generation" }),
    refetchInterval: 2000,
  });

  const activeSlideJobsQuery = useQuery({
    ...trpc.generation.active.queryOptions(),
    refetchInterval: 2000,
  });

  const activeHookJobs = activeHookJobsQuery.data ?? [];
  const activeSlideJobs = activeSlideJobsQuery.data ?? [];
  const isGeneratingHooks = activeHookJobs.length > 0;
  const isGeneratingSlides = activeSlideJobs.length > 0;

  const hooksQuery = useQuery({
    ...trpc.hooks.list.queryOptions({ status: "draft" }),
    refetchInterval: isGeneratingHooks ? 3000 : false,
  });

  const hooks = hooksQuery.data ?? [];

  const generateMutation = useMutation({
    ...trpc.hooks.generate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const createSlidesMutation = useMutation({
    ...trpc.generation.createSlides.mutationOptions(),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries();
    },
  });

  const deleteMutation = useMutation({
    ...trpc.hooks.deleteMany.mutationOptions(),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries();
    },
  });

  const createPinterestSlidesMutation = useMutation({
    ...trpc.generation.createSlidesFromPinterest.mutationOptions(),
    onSuccess: () => {
      setSelectedIds(new Set());
      setPinterestPickerOpen(false);
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Generate Content</h1>
      </div>

      {isGeneratingHooks && <HookGenerationBanner jobs={activeHookJobs} />}

      {isGeneratingSlides && <SlideGenerationBanner jobs={activeSlideJobs} />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Hooks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Claude generates hooks using your product settings and learned
            formulas, then recursively improves them until they score 7.5+/10.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Count:</span>
            {[1, 3, 5, 10].map((n) => (
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
            disabled={generateMutation.isPending || isGeneratingHooks}
          >
            {generateMutation.isPending
              ? "Starting..."
              : isGeneratingHooks
                ? "Generation in progress..."
                : "Generate Hooks"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5" />
              Draft Hooks
              {hooks.length > 0 && (
                <Badge variant="secondary">{hooks.length}</Badge>
              )}
            </CardTitle>
            {hooks.length > 0 && (
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
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {hooks.length === 0 && !isGeneratingHooks && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No draft hooks yet. Generate some above to get started.
            </p>
          )}

          {hooks.length === 0 && isGeneratingHooks && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Hooks are being generated. They'll appear here when ready.
            </p>
          )}

          {hooks.length > 0 && (
            <>
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

              <div className="flex items-center gap-3 pt-2 border-t">
                {imageMode === "ai" ? (
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
                ) : (
                  <Button
                    onClick={() => setPinterestPickerOpen(true)}
                    disabled={selectedIds.size === 0}
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Pick Pinterest Images ({selectedIds.size})
                  </Button>
                )}
                <div className="flex rounded-md border">
                  <Button
                    variant={imageMode === "ai" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setImageMode("ai")}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI
                  </Button>
                  <Button
                    variant={imageMode === "pinterest" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setImageMode("pinterest")}
                  >
                    <Image className="h-3 w-3 mr-1" />
                    Pinterest
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  onClick={() =>
                    deleteMutation.mutate({
                      ids: Array.from(selectedIds),
                    })
                  }
                  disabled={
                    selectedIds.size === 0 || deleteMutation.isPending
                  }
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleteMutation.isPending
                    ? "Deleting..."
                    : `Delete (${selectedIds.size})`}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size}/{hooks.length} selected
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PinterestPicker
        hookIds={Array.from(selectedIds)}
        slideCount={4}
        open={pinterestPickerOpen}
        onConfirm={(selections) =>
          createPinterestSlidesMutation.mutate({ items: selections })
        }
        onCancel={() => setPinterestPickerOpen(false)}
      />
    </div>
  );
}

function HookGenerationBanner({
  jobs,
}: {
  jobs: { id: number; status: string; progress: number | null; total: number | null; error: string | null }[];
}) {
  const job = jobs[0];
  if (!job) return null;

  const progress =
    job.total && job.total > 0
      ? Math.round(((job.progress ?? 0) / job.total) * 100)
      : undefined;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-primary/5 px-4 py-3">
      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Generating hooks...</p>
        {progress !== undefined && (
          <Progress value={progress} className="mt-1.5 h-1.5" />
        )}
      </div>
      <Badge variant="secondary" className="shrink-0">
        {job.status}
      </Badge>
    </div>
  );
}

function SlideGenerationBanner({
  jobs,
}: {
  jobs: { id: number; status: string; currentSlide: number | null; totalSlides: number | null }[];
}) {
  const completed = jobs.filter(
    (j) => j.status === "completed"
  ).length;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-blue-500/5 px-4 py-3">
      <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Generating slides ({completed}/{jobs.length} complete)
        </p>
        <Progress
          value={(completed / jobs.length) * 100}
          className="mt-1.5 h-1.5"
        />
      </div>
      <Badge variant="secondary" className="shrink-0">
        {jobs.length} job{jobs.length !== 1 ? "s" : ""}
      </Badge>
    </div>
  );
}
