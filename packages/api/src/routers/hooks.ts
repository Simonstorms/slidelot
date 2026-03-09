import { router, publicProcedure } from "../index";
import { hooks, settings, posts, generationJobs, learnings, imageTests } from "@slidelot/db/schema";
import { db } from "@slidelot/db";
import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  generateWithRecursiveImprovement,
  generateWinnerVariations,
} from "../services/claude";
import { createBgJob, updateBgJob } from "../services/bg-jobs";
import type { db as dbType } from "@slidelot/db";

async function getSettingsFromDb(database: typeof dbType) {
  const rows = await database.select().from(settings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return {
    niche: result.niche ?? "",
    productName: result.productName ?? "",
    productDescription: result.productDescription ?? "",
    targetAudience: result.targetAudience ?? "",
    ctaStyle: result.ctaStyle ?? "soft",
    productUrl: result.productUrl ?? "",
  };
}

async function runHookGeneration(jobId: number, count: number) {
  try {
    await updateBgJob(jobId, { status: "running" });

    const s = await getSettingsFromDb(db);
    const generated = await generateWithRecursiveImprovement(s, count);

    for (const hook of generated) {
      await db.insert(hooks).values({
        text: hook.text,
        formula: hook.formula,
        slideTexts: hook.slideTexts,
        sceneDescriptions: hook.sceneDescriptions,
        score: hook.score,
        scoreBreakdown: hook.scoreBreakdown,
        status: "draft",
      });
    }

    await updateBgJob(jobId, { status: "completed", progress: count });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    await updateBgJob(jobId, { status: "failed", error });
  }
}

async function runVariationGeneration(jobId: number, hookId: number) {
  try {
    await updateBgJob(jobId, { status: "running" });

    const s = await getSettingsFromDb(db);
    const variations = await generateWinnerVariations(hookId, s);

    for (const v of variations) {
      await db.insert(hooks).values({
        text: v.text,
        formula: v.formula,
        slideTexts: v.slideTexts,
        sceneDescriptions: v.sceneDescriptions,
        parentHookId: hookId,
        status: "draft",
      });
    }

    await updateBgJob(jobId, {
      status: "completed",
      progress: variations.length,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    await updateBgJob(jobId, { status: "failed", error });
  }
}

export const hooksRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          status: z
            .enum(["draft", "untested", "winner", "loser"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.status) {
        return ctx.db
          .select()
          .from(hooks)
          .where(eq(hooks.status, input.status))
          .orderBy(desc(hooks.score), desc(hooks.createdAt));
      }
      return ctx.db
        .select()
        .from(hooks)
        .orderBy(desc(hooks.score), desc(hooks.createdAt));
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const [hook] = await ctx.db
        .select()
        .from(hooks)
        .where(eq(hooks.id, input.id));
      return hook ?? null;
    }),

  generate: publicProcedure
    .input(z.object({ count: z.number().min(1).max(20).default(5) }))
    .mutation(async ({ input }) => {
      const job = await createBgJob(
        "hook_generation",
        { count: input.count },
        input.count
      );
      runHookGeneration(job.id, input.count);
      return { jobId: job.id };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        text: z.string().optional(),
        formula: z.string().optional(),
        slideTexts: z.array(z.string()).optional(),
        sceneDescriptions: z.array(z.string()).optional(),
        status: z.enum(["draft", "untested", "winner", "loser"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      await ctx.db
        .update(hooks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(hooks.id, id));
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(hooks).where(eq(hooks.id, input.id));
    }),

  deleteMany: publicProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return;
      await ctx.db.delete(generationJobs).where(inArray(generationJobs.hookId, input.ids));
      await ctx.db.delete(posts).where(inArray(posts.hookId, input.ids));
      await ctx.db.delete(learnings).where(inArray(learnings.hookId, input.ids));
      await ctx.db.delete(imageTests).where(inArray(imageTests.hookId, input.ids));
      await ctx.db.delete(hooks).where(inArray(hooks.id, input.ids));
    }),

  generateVariations: publicProcedure
    .input(z.object({ hookId: z.number() }))
    .mutation(async ({ input }) => {
      const job = await createBgJob(
        "hook_generation",
        { hookId: input.hookId, type: "variations" },
        3
      );
      runVariationGeneration(job.id, input.hookId);
      return { jobId: job.id };
    }),
});
