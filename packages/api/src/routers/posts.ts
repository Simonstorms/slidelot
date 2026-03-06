import { router, publicProcedure } from "../index";
import { posts, hooks, analytics, generationJobs } from "@marketing-ai/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { postDraft } from "../services/postiz";
import { env } from "@marketing-ai/env/server";
import { runGenerationJob } from "./generation";

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
});
