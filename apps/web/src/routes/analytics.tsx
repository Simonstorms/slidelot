import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { DiagnosisMatrix } from "@/components/diagnosis-matrix";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/analytics")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        context.trpc.analytics.dashboard.queryOptions()
      ),
      context.queryClient.ensureQueryData(
        context.trpc.analytics.diagnosis.queryOptions()
      ),
    ]);
  },
  component: AnalyticsPage,
});

const quadrantColors: Record<string, string> = {
  winner: "bg-green-100 text-green-800",
  wrong_audience: "bg-yellow-100 text-yellow-800",
  weak_hook: "bg-blue-100 text-blue-800",
  dud: "bg-red-100 text-red-800",
};

const quadrantLabels: Record<string, string> = {
  winner: "Winner",
  wrong_audience: "Wrong Audience",
  weak_hook: "Weak Hook",
  dud: "Dud",
};

function AnalyticsPage() {
  const { data: dashboard } = useQuery(
    trpc.analytics.dashboard.queryOptions()
  );
  const { data: diagnosis } = useQuery(
    trpc.analytics.diagnosis.queryOptions()
  );

  const pullMutation = useMutation({
    ...trpc.analytics.pull.mutationOptions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      toast.success(`Updated analytics for ${data.updated} posts`);
    },
  });

  const reportMutation = useMutation({
    ...trpc.analytics.report.mutationOptions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      toast.success(
        `Report complete: ${data.winnersFound} winners, ${data.learningsCreated} new learnings`
      );
    },
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => pullMutation.mutate()}
            disabled={pullMutation.isPending}
          >
            {pullMutation.isPending ? "Pulling..." : "Pull Analytics"}
          </Button>
          <Button
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending}
          >
            {reportMutation.isPending ? "Running..." : "Run Report"}
          </Button>
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Views"
            value={dashboard.totalViews.toLocaleString()}
          />
          <StatCard
            title="Avg Views/Post"
            value={dashboard.avgViews.toLocaleString()}
          />
          <StatCard title="Conversions" value={dashboard.totalConversions} />
          <StatCard title="Win Rate" value={`${dashboard.winRate}%`} />
        </div>
      )}

      {diagnosis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Diagnosis Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <DiagnosisMatrix quadrants={diagnosis.quadrants} />
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <p>Median Views: {diagnosis.medianViews.toLocaleString()}</p>
                <p>Median Conversions: {diagnosis.medianConversions}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Table</CardTitle>
            </CardHeader>
            <CardContent>
              {diagnosis.posts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No posted content yet
                </p>
              ) : (
                <div className="overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hook</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Conv</TableHead>
                        <TableHead>Diagnosis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnosis.posts.map((p) => (
                        <TableRow key={p.postId}>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {p.hookText}
                          </TableCell>
                          <TableCell>{p.views.toLocaleString()}</TableCell>
                          <TableCell>{p.conversions}</TableCell>
                          <TableCell>
                            <Badge
                              className={quadrantColors[p.quadrant] ?? ""}
                            >
                              {quadrantLabels[p.quadrant] ?? p.quadrant}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
