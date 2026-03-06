import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const stageLabels: Record<string, string> = {
  pending: "Queued",
  generating: "Generating images",
  processing: "Adding text overlays",
  captioning: "Writing caption",
  completed: "Done",
  failed: "Failed",
};

export function GenerationProgress({ jobIds }: { jobIds: number[] }) {
  const { data: jobs } = useQuery({
    ...trpc.generation.status.queryOptions({ jobIds }),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      const allDone = data.every(
        (j) => j.status === "completed" || j.status === "failed"
      );
      return allDone ? false : 2000;
    },
  });

  if (!jobs || jobs.length === 0) return null;

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const totalProgress =
    jobs.reduce((sum, j) => {
      if (j.status === "completed") return sum + 100;
      if (j.status === "failed") return sum + 100;
      if (j.status === "captioning") return sum + 90;
      if (j.status === "processing") return sum + 75;
      if (j.status === "generating")
        return sum + ((j.currentSlide ?? 0) / (j.totalSlides ?? 6)) * 70;
      return sum;
    }, 0) / jobs.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {completedCount}/{jobs.length} complete
          {failedCount > 0 && ` (${failedCount} failed)`}
        </span>
        <span className="text-sm text-muted-foreground">
          {Math.round(totalProgress)}%
        </span>
      </div>
      <Progress value={totalProgress} />

      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between text-sm border rounded px-3 py-2"
          >
            <span>Job #{job.id}</span>
            <div className="flex items-center gap-2">
              {job.status === "generating" && (
                <span className="text-muted-foreground">
                  Slide {job.currentSlide}/{job.totalSlides}
                </span>
              )}
              <Badge
                variant={
                  job.status === "completed"
                    ? "default"
                    : job.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {stageLabels[job.status] ?? job.status}
              </Badge>
            </div>
            {job.error && (
              <p className="text-xs text-destructive mt-1 w-full">
                {job.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
