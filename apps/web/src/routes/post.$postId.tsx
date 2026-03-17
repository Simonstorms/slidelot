import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SlidePreviewer } from "@/components/slide-previewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/post/$postId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      context.trpc.posts.get.queryOptions({ id: Number(params.postId) })
    ),
  component: PostDetailPage,
});

const statusColors: Record<string, string> = {
  generating: "bg-yellow-100 text-yellow-800",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  pipeline: "bg-purple-100 text-purple-800",
  posted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  failed: "bg-destructive/10 text-destructive",
};

function PostDetailPage() {
  const { postId } = Route.useParams();
  const { data } = useQuery(
    trpc.posts.get.queryOptions({ id: Number(postId) })
  );
  const [rejectReason, setRejectReason] = useState("");

  const approveMutation = useMutation({
    ...trpc.posts.approve.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Post approved");
    },
  });

  const pipelineMutation = useMutation({
    ...trpc.posts.moveToPipeline.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Moved to pipeline");
    },
  });

  const postedMutation = useMutation({
    ...trpc.posts.markAsPosted.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Marked as posted");
    },
  });

  const rejectMutation = useMutation({
    ...trpc.posts.reject.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Post rejected");
    },
  });

  const captionMutation = useMutation({
    ...trpc.posts.updateCaption.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Caption updated");
    },
  });

  const regenerateMutation = useMutation({
    ...trpc.posts.regenerate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Regeneration started");
    },
  });

  if (!data) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <p className="text-muted-foreground">Post not found</p>
      </div>
    );
  }

  const { post, hook, analytics } = data;
  const isPending = post.status === "pending";
  const canEdit = isPending || post.status === "approved";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Post #{post.id}</h1>
        <Badge className={statusColors[post.status] ?? ""}>{post.status}</Badge>
      </div>

      {post.slides && post.slides.length > 0 && (
        <SlidePreviewer
          slides={post.slides}
          cleanSlides={post.cleanSlides}
          postId={post.id}
          editable={canEdit}
          slideTextOverlays={post.slideTextOverlays}
          hookSlideTexts={hook?.slideTexts as string[] | null}
        />
      )}

      {hook && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{hook.text}</p>
            <div className="flex gap-2 flex-wrap">
              {hook.formula && (
                <Badge variant="outline">{hook.formula}</Badge>
              )}
              {hook.score !== null && hook.score > 0 && (
                <Badge variant="secondary">{hook.score}/10</Badge>
              )}
              <Badge>{hook.status}</Badge>
            </div>
            {hook.slideTexts && (
              <div className="flex gap-1 flex-wrap mt-2">
                {(hook.slideTexts as string[]).map((t, i) => (
                  <span
                    key={i}
                    className="text-xs bg-muted px-2 py-0.5 rounded"
                  >
                    {i + 1}. {t}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Caption</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit ? (
            <>
              <Textarea
                defaultValue={post.caption ?? ""}
                rows={4}
                onBlur={(e) => {
                  if (e.target.value !== post.caption) {
                    captionMutation.mutate({
                      id: post.id,
                      caption: e.target.value,
                    });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Edit caption and click outside to save
              </p>
            </>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {post.caption ?? "No caption"}
            </p>
          )}
        </CardContent>
      </Card>

      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {(analytics.views ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Views</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(analytics.likes ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Likes</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(analytics.comments ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Comments</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(analytics.shares ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Shares</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {post.status === "failed" && (
        <div className="flex gap-3">
          <Button
            onClick={() => regenerateMutation.mutate({ id: post.id })}
            disabled={regenerateMutation.isPending}
          >
            {regenerateMutation.isPending ? "Retrying..." : "Retry Generation"}
          </Button>
        </div>
      )}

      {isPending && (
        <div className="flex gap-3">
          <Button
            onClick={() => approveMutation.mutate({ id: post.id })}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? "Approving..." : "Approve"}
          </Button>

          <Dialog>
            <DialogTrigger render={<Button variant="destructive" />}>
              Reject
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Post</DialogTitle>
              </DialogHeader>
              <Textarea
                placeholder="Rejection reason (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <Button
                variant="destructive"
                onClick={() => {
                  rejectMutation.mutate({
                    id: post.id,
                    reason: rejectReason || undefined,
                  });
                }}
              >
                Confirm Reject
              </Button>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => regenerateMutation.mutate({ id: post.id })}
            disabled={regenerateMutation.isPending}
          >
            Regenerate
          </Button>
        </div>
      )}

      {post.status === "approved" && (
        <div className="flex gap-3">
          <Button
            onClick={() => pipelineMutation.mutate({ id: post.id })}
            disabled={pipelineMutation.isPending}
          >
            {pipelineMutation.isPending ? "Moving..." : "Move to Pipeline"}
          </Button>
          <Button
            variant="outline"
            onClick={() => regenerateMutation.mutate({ id: post.id })}
            disabled={regenerateMutation.isPending}
          >
            Regenerate
          </Button>
        </div>
      )}

      {post.status === "pipeline" && (
        <div className="flex gap-3">
          <Button
            onClick={() => postedMutation.mutate({ id: post.id })}
            disabled={postedMutation.isPending}
          >
            {postedMutation.isPending ? "Updating..." : "Mark as Posted"}
          </Button>
        </div>
      )}
    </div>
  );
}
