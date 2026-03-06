import { router, publicProcedure } from "../index";
import { hooks, settings } from "@marketing-ai/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  generateWithRecursiveImprovement,
  generateWinnerVariations,
} from "../services/claude";
import type { db as dbType } from "@marketing-ai/db";

async function getSettingsFromDb(db: typeof dbType) {
  const rows = await db.select().from(settings);
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
    .mutation(async ({ ctx, input }) => {
      const s = await getSettingsFromDb(ctx.db);

      const generated = await generateWithRecursiveImprovement(
        s,
        input.count
      );

      const inserted = [];
      for (const hook of generated) {
        const [row] = await ctx.db
          .insert(hooks)
          .values({
            text: hook.text,
            formula: hook.formula,
            slideTexts: hook.slideTexts,
            sceneDescription: hook.sceneDescription,
            score: hook.score,
            scoreBreakdown: hook.scoreBreakdown,
            status: "draft",
          })
          .returning();
        inserted.push(row);
      }

      return inserted;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        text: z.string().optional(),
        formula: z.string().optional(),
        slideTexts: z.array(z.string()).optional(),
        sceneDescription: z.string().optional(),
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

  generateVariations: publicProcedure
    .input(z.object({ hookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const s = await getSettingsFromDb(ctx.db);
      const variations = await generateWinnerVariations(input.hookId, s);

      const inserted = [];
      for (const v of variations) {
        const [row] = await ctx.db
          .insert(hooks)
          .values({
            text: v.text,
            formula: v.formula,
            slideTexts: v.slideTexts,
            sceneDescription: v.sceneDescription,
            parentHookId: input.hookId,
            status: "draft",
          })
          .returning();
        inserted.push(row);
      }

      return inserted;
    }),
});
