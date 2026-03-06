import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      context.trpc.analytics.dashboard.queryOptions()
    ),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useQuery(trpc.analytics.dashboard.queryOptions());

  const pullMutation = useMutation({
    ...trpc.analytics.pull.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const reportMutation = useMutation({
    ...trpc.analytics.report.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (!data) return null;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Posts Published" value={data.postedCount} />
        <StatCard title="Total Views" value={data.totalViews.toLocaleString()} />
        <StatCard title="Win Rate" value={`${data.winRate}%`} />
        <StatCard title="Queue Size" value={data.pendingCount} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Avg Views/Post" value={data.avgViews.toLocaleString()} />
        <StatCard title="Total Likes" value={data.totalLikes.toLocaleString()} />
        <StatCard title="Conversions" value={data.totalConversions} />
        <StatCard title="Learnings" value={data.learningsCount} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link to="/generate">
          <Button>Generate Hooks</Button>
        </Link>
        <Link to="/queue">
          <Button variant="outline">
            Review Queue
            {data.pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {data.pendingCount}
              </Badge>
            )}
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={() => pullMutation.mutate()}
          disabled={pullMutation.isPending}
        >
          {pullMutation.isPending ? "Pulling..." : "Pull Analytics"}
        </Button>
        <Button
          variant="outline"
          onClick={() => reportMutation.mutate()}
          disabled={reportMutation.isPending}
        >
          {reportMutation.isPending ? "Running..." : "Run Report"}
        </Button>
      </div>

      {data.topPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topPosts.map((p) => (
                <Link
                  key={p.post.id}
                  to="/post/$postId"
                  params={{ postId: String(p.post.id) }}
                  className="flex items-center justify-between p-3 rounded border hover:bg-muted transition-colors"
                >
                  <span className="text-sm truncate flex-1">
                    {p.hookText}
                  </span>
                  <div className="flex gap-3 text-sm text-muted-foreground ml-4">
                    <span>{(p.views ?? 0).toLocaleString()} views</span>
                    <span>{p.conversions ?? 0} conv</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
