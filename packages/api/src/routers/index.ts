import { publicProcedure, router } from "../index";
import { settingsRouter } from "./settings";
import { hooksRouter } from "./hooks";
import { postsRouter } from "./posts";
import { generationRouter } from "./generation";
import { analyticsRouter } from "./analytics";
import { imageTestRouter } from "./image-test";
import { bgJobsRouter } from "./bg-jobs";
import { generationJobs, posts, imageTests } from "@marketing-ai/db/schema";
import { inArray } from "drizzle-orm";
import type { db as dbType } from "@marketing-ai/db";
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

  const staleTests = await db
    .select({ id: imageTests.id })
    .from(imageTests)
    .where(inArray(imageTests.status, ["pending", "generating"]));

  if (staleTests.length > 0) {
    await db
      .update(imageTests)
      .set({ status: "failed", error: "Server restarted during generation" })
      .where(inArray(imageTests.id, staleTests.map((t) => t.id)));
    console.log(`Marked ${staleTests.length} stale image test(s) as failed`);
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
  imageTest: imageTestRouter,
  bgJobs: bgJobsRouter,
});

export type AppRouter = typeof appRouter;
