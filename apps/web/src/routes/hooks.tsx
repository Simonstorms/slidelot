import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/hooks")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      context.trpc.hooks.list.queryOptions()
    ),
  component: HooksPage,
});

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  untested: "bg-blue-100 text-blue-800",
  winner: "bg-green-100 text-green-800",
  loser: "bg-red-100 text-red-800",
};

function HooksPage() {
  const [tab, setTab] = useState("all");
  const { data: allHooks } = useQuery(trpc.hooks.list.queryOptions());

  const filteredHooks =
    tab === "all"
      ? allHooks
      : allHooks?.filter((h) => h.status === tab);

  const deleteMutation = useMutation({
    ...trpc.hooks.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Hook deleted");
    },
  });

  const variationsMutation = useMutation({
    ...trpc.hooks.generateVariations.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Variations generated");
    },
  });

  const createSlidesMutation = useMutation({
    ...trpc.generation.createSlides.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Slide generation started");
    },
  });

  const countByStatus = (status: string) =>
    allHooks?.filter((h) => h.status === status).length ?? 0;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Hook Library</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({allHooks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="winner">
            Winners ({countByStatus("winner")})
          </TabsTrigger>
          <TabsTrigger value="loser">
            Losers ({countByStatus("loser")})
          </TabsTrigger>
          <TabsTrigger value="untested">
            Untested ({countByStatus("untested")})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({countByStatus("draft")})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {!filteredHooks || filteredHooks.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No hooks found
            </p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">Hook</TableHead>
                    <TableHead>Formula</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHooks.map((hook) => (
                    <TableRow key={hook.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{hook.text}</p>
                          {hook.slideTexts && (
                            <div className="flex gap-1 flex-wrap">
                              {(hook.slideTexts as string[])
                                .slice(0, 3)
                                .map((t, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-muted px-1.5 py-0.5 rounded"
                                  >
                                    {t}
                                  </span>
                                ))}
                              {(hook.slideTexts as string[]).length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{(hook.slideTexts as string[]).length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          {hook.parentHookId && (
                            <span className="text-xs text-muted-foreground">
                              Variation of #{hook.parentHookId}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hook.formula && (
                          <Badge variant="outline" className="text-xs">
                            {hook.formula}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hook.score !== null && hook.score > 0
                          ? `${hook.score}/10`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {hook.viewCount
                          ? hook.viewCount.toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[hook.status] ?? ""}>
                          {hook.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              createSlidesMutation.mutate({
                                hookIds: [hook.id],
                              })
                            }
                          >
                            Slides
                          </Button>
                          {hook.status === "winner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                variationsMutation.mutate({
                                  hookId: hook.id,
                                })
                              }
                              disabled={variationsMutation.isPending}
                            >
                              Variations
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() =>
                              deleteMutation.mutate({ id: hook.id })
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
