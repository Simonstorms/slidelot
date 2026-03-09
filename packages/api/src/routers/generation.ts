import { router, publicProcedure } from "../index";
import {
  generationJobs,
  posts,
  hooks,
  settings,
} from "@slidelot/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { generateAllSlides } from "../services/fal-image";
import { processAllSlides } from "../services/image-processor";
import { generateCaption } from "../services/claude";
import { env } from "@slidelot/env/server";
import { resolve, join } from "node:path";
import type { db as dbType } from "@slidelot/db";

export async function runGenerationJob(
  jobId: number,
  hookId: number,
  postId: number,
  db: typeof dbType
) {
  try {
    const [hook] = await db.select().from(hooks).where(eq(hooks.id, hookId));
    if (!hook || !hook.slideTexts || !hook.sceneDescriptions) {
      throw new Error("Hook missing required data");
    }

    await db
      .update(generationJobs)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));

    const uploadsDir = resolve(env.UPLOADS_DIR);
    const tempDir = join(uploadsDir, "temp", String(postId));

    const rawPaths = await generateAllSlides(
      hook.sceneDescriptions,
      hook.slideTexts,
      jobId,
      tempDir
    );

    await db
      .update(generationJobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));

    const { slides: slidePaths, cleanSlides } = await processAllSlides(
      rawPaths,
      hook.slideTexts,
      postId,
      uploadsDir
    );

    await db
      .update(generationJobs)
      .set({ status: "captioning", updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));

    const settingsRows = await db.select().from(settings);
    const s: Record<string, string> = {};
    for (const row of settingsRows) {
      s[row.key] = row.value;
    }

    const caption = await generateCaption(hook.text, hook.slideTexts, {
      niche: s.niche ?? "",
      productName: s.productName ?? "",
      productDescription: s.productDescription ?? "",
      targetAudience: s.targetAudience ?? "",
      ctaStyle: s.ctaStyle ?? "soft",
      productUrl: s.productUrl ?? "",
    });

    await db
      .update(posts)
      .set({
        slides: slidePaths,
        cleanSlides,
        caption,
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    await db
      .update(generationJobs)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(generationJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));

    await db
      .update(posts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(posts.id, postId));
  }
}

export const generationRouter = router({
  createSlides: publicProcedure
    .input(z.object({ hookIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const jobIds: number[] = [];

      for (const hookId of input.hookIds) {
        const [post] = await ctx.db
          .insert(posts)
          .values({ hookId, status: "generating" })
          .returning();

        if (!post) throw new Error("Failed to create post");

        const [job] = await ctx.db
          .insert(generationJobs)
          .values({
            hookId,
            postId: post.id,
            status: "pending",
          })
          .returning();

        if (!job) throw new Error("Failed to create generation job");

        jobIds.push(job.id);

        runGenerationJob(job.id, hookId, post.id, ctx.db);
      }

      return { jobIds };
    }),

  status: publicProcedure
    .input(z.object({ jobIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => {
      if (input.jobIds.length === 0) return [];
      return ctx.db
        .select()
        .from(generationJobs)
        .where(inArray(generationJobs.id, input.jobIds));
    }),

  active: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(generationJobs)
        .where(inArray(generationJobs.status, ["pending", "generating", "processing", "captioning"]));
    }),

  retry: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .select()
        .from(generationJobs)
        .where(eq(generationJobs.id, input.jobId));

      if (!job) throw new Error("Job not found");
      if (!job.postId) throw new Error("Job missing post reference");

      await ctx.db
        .update(generationJobs)
        .set({
          status: "pending",
          error: null,
          currentSlide: 0,
          updatedAt: new Date(),
        })
        .where(eq(generationJobs.id, input.jobId));

      runGenerationJob(job.id, job.hookId, job.postId, ctx.db);

      return { success: true };
    }),
});
