import { publicProcedure, router } from "../index";
import { settingsRouter } from "./settings";
import { hooksRouter } from "./hooks";
import { postsRouter } from "./posts";
import { generationRouter } from "./generation";
import { analyticsRouter } from "./analytics";
import { bgJobsRouter } from "./bg-jobs";
import { pinterestRouter } from "./pinterest";
import { generationJobs, posts } from "@slidelot/db/schema";
import { inArray } from "drizzle-orm";
import type { db as dbType } from "@slidelot/db";
import { recoverStaleBgJobs } from "../services/bg-jobs";

export async function recoverOrphanedJobs(db: typeof dbType) {
  await recoverStaleBgJobs();
  const orphanedJobs = await db
    .select({ id: generationJobs.id, postId: generationJobs.postId })
    .from(generationJobs)
    .where(inArray(generationJobs.status, ["generating", "processing", "captioning"]));

  if (orphanedJobs.length > 0) {
    await db
      .update(generationJobs)
      .set({ status: "failed", error: "Server restarted during generation", updatedAt: new Date() })
      .where(inArray(generationJobs.id, orphanedJobs.map((j) => j.id)));

    console.log(`Marked ${orphanedJobs.length} orphaned generation job(s) as failed`);
  }

  const orphanedPosts = await db
    .select({ id: posts.id })
    .from(posts)
    .where(inArray(posts.status, ["generating"]));

  if (orphanedPosts.length > 0) {
    await db
      .update(posts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(inArray(posts.id, orphanedPosts.map((p) => p.id)));

    console.log(`Marked ${orphanedPosts.length} orphaned post(s) as failed`);
  }

}

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  settings: settingsRouter,
  hooks: hooksRouter,
  posts: postsRouter,
  generation: generationRouter,
  analytics: analyticsRouter,
  bgJobs: bgJobsRouter,
  pinterest: pinterestRouter,
});

export type AppRouter = typeof appRouter;
