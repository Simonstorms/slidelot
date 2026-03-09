import { router, publicProcedure } from "../index";
import { posts, hooks, analytics, generationJobs } from "@slidelot/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { postDraft } from "../services/postiz";
import { env } from "@slidelot/env/server";
import { runGenerationJob } from "./generation";
import { join } from "node:path";
import { reprocessSingleSlide } from "../services/image-processor";

export const postsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "generating",
              "pending",
              "approved",
              "posted",
              "rejected",
              "failed",
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.status) {
        return ctx.db
          .select({
            post: posts,
            hookText: hooks.text,
            hookFormula: hooks.formula,
          })
          .from(posts)
          .leftJoin(hooks, eq(posts.hookId, hooks.id))
          .where(eq(posts.status, input.status))
          .orderBy(desc(posts.createdAt));
      }
      return ctx.db
        .select({
          post: posts,
          hookText: hooks.text,
          hookFormula: hooks.formula,
        })
        .from(posts)
        .leftJoin(hooks, eq(posts.hookId, hooks.id))
        .orderBy(desc(posts.createdAt));
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select({
          post: posts,
          hook: hooks,
        })
        .from(posts)
        .leftJoin(hooks, eq(posts.hookId, hooks.id))
        .where(eq(posts.id, input.id));

      if (!result) return null;

      const [postAnalytics] = await ctx.db
        .select()
        .from(analytics)
        .where(eq(analytics.postId, input.id));

      return { ...result, analytics: postAnalytics ?? null };
    }),

  approve: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .select()
        .from(posts)
        .where(eq(posts.id, input.id));

      if (!post) throw new Error("Post not found");
      if (!post.slides || !post.caption) {
        throw new Error("Post missing slides or caption");
      }

      try {
        const postizId = await postDraft(
          post.slides,
          post.caption,
          env.UPLOADS_DIR
        );

        await ctx.db
          .update(posts)
          .set({
            status: "posted",
            postizId,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, input.id));

        await ctx.db
          .update(hooks)
          .set({ status: "untested", updatedAt: new Date() })
          .where(eq(hooks.id, post.hookId));

        return { success: true, postizId };
      } catch (error) {
        await ctx.db
          .update(posts)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(posts.id, input.id));

        throw error;
      }
    }),

  reject: publicProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(posts)
        .set({
          status: "rejected",
          rejectionReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, input.id));
    }),

  updateCaption: publicProcedure
    .input(z.object({ id: z.number(), caption: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(posts)
        .set({ caption: input.caption, updatedAt: new Date() })
        .where(eq(posts.id, input.id));
    }),

  regenerate: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .select()
        .from(posts)
        .where(eq(posts.id, input.id));

      if (!post) throw new Error("Post not found");

      await ctx.db
        .update(posts)
        .set({
          status: "generating",
          slides: null,
          cleanSlides: null,
          caption: null,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, input.id));

      const [job] = await ctx.db
        .insert(generationJobs)
        .values({
          hookId: post.hookId,
          postId: post.id,
          status: "pending",
        })
        .returning();

      if (!job) throw new Error("Failed to create generation job");

      runGenerationJob(job.id, post.hookId, post.id, ctx.db);

      return { hookId: post.hookId, postId: post.id, jobId: job.id };
    }),

  updateSlideText: publicProcedure
    .input(
      z.object({
        postId: z.number(),
        slideIndex: z.number(),
        text: z.string(),
        xPercent: z.number().min(0).max(100),
        yPercent: z.number().min(0).max(100),
        fontScale: z.number().min(0.2).max(5).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select({ post: posts, hook: hooks })
        .from(posts)
        .leftJoin(hooks, eq(posts.hookId, hooks.id))
        .where(eq(posts.id, input.postId));

      if (!result) throw new Error("Post not found");
      const { post, hook } = result;

      const cleanSlides = post.cleanSlides as string[] | null;
      const slides = post.slides as string[] | null;
      const cleanSlide = cleanSlides?.[input.slideIndex];
      const slide = slides?.[input.slideIndex];
      if (!cleanSlide || !slide) {
        throw new Error("Slide not found");
      }

      const cleanSlidePath = join(env.UPLOADS_DIR, cleanSlide);
      const outputPath = join(env.UPLOADS_DIR, slide);

      await reprocessSingleSlide(
        cleanSlidePath,
        outputPath,
        input.text,
        input.xPercent,
        input.yPercent,
        input.fontScale
      );

      const hookSlideTexts = (hook?.slideTexts as string[] | null) ?? [];
      const existing = (post.slideTextOverlays as { text: string; xPercent: number; yPercent: number; fontScale: number }[] | null)
        ?? hookSlideTexts.map((t) => ({ text: t, xPercent: 50, yPercent: 30, fontScale: 1 }));

      const overlays = [...existing];
      while (overlays.length <= input.slideIndex) {
        overlays.push({ text: "", xPercent: 50, yPercent: 30, fontScale: 1 });
      }
      overlays[input.slideIndex] = {
        text: input.text,
        xPercent: input.xPercent,
        yPercent: input.yPercent,
        fontScale: input.fontScale,
      };

      await ctx.db
        .update(posts)
        .set({ slideTextOverlays: overlays, updatedAt: new Date() })
        .where(eq(posts.id, input.postId));

      return { slidePath: `${slide}?t=${Date.now()}` };
    }),
});
