import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@slidelot/env/web";

export const Route = createFileRoute("/queue")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      context.trpc.posts.list.queryOptions()
    ),
  component: QueuePage,
});

const statusColors: Record<string, string> = {
  generating: "bg-yellow-100 text-yellow-800",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  posted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  failed: "bg-destructive/10 text-destructive",
};

function QueuePage() {
  const [tab, setTab] = useState("all");
  const { data: allPosts } = useQuery(trpc.posts.list.queryOptions());

  const filteredPosts =
    tab === "all"
      ? allPosts
      : allPosts?.filter((p) => p.post.status === tab);

  const approveMutation = useMutation({
    ...trpc.posts.approve.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const rejectMutation = useMutation({
    ...trpc.posts.reject.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Review Queue</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({allPosts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending (
            {allPosts?.filter((p) => p.post.status === "pending").length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="posted">Posted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {!filteredPosts || filteredPosts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No posts found
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map(({ post, hookText, hookFormula }) => (
                <Card key={post.id} className="overflow-hidden">
                  {post.slides && post.slides.length > 0 && (
                    <div className="aspect-[2/3] max-h-48 overflow-hidden bg-muted">
                      <img
                        src={`${env.VITE_SERVER_URL}/uploads/${post.slides[0]}`}
                        alt="Slide 1"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2 flex-1">
                        {hookText}
                      </p>
                      <Badge className={statusColors[post.status] ?? ""}>
                        {post.status}
                      </Badge>
                    </div>

                    {hookFormula && (
                      <Badge variant="outline" className="text-xs">
                        {hookFormula}
                      </Badge>
                    )}

                    <div className="flex gap-2">
                      <Link
                        to="/post/$postId"
                        params={{ postId: String(post.id) }}
                      >
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      {post.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              approveMutation.mutate({ id: post.id })
                            }
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              rejectMutation.mutate({ id: post.id })
                            }
                            disabled={rejectMutation.isPending}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
