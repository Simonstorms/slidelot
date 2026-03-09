import { router, publicProcedure } from "../index";
import { z } from "zod";
import {
  generateTestImage,
  FAL_MODEL_OPTIONS,
  PROMPT_STYLES,
  buildPromptWithStyle,
} from "../services/fal-image";
import type { FalModel } from "../services/fal-image";
import { hooks, imageTests } from "@marketing-ai/db/schema";
import { db } from "@marketing-ai/db";
import { desc, isNotNull, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

async function runImageTest(testId: number, prompt: string, model: string) {
  try {
    await db
      .update(imageTests)
      .set({ status: "generating" })
      .where(eq(imageTests.id, testId));

    const imageUrl = await generateTestImage(prompt, model as FalModel);

    await db
      .update(imageTests)
      .set({ status: "completed", imageUrl })
      .where(eq(imageTests.id, testId));
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    await db
      .update(imageTests)
      .set({ status: "failed", error })
      .where(eq(imageTests.id, testId));
  }
}

export const imageTestRouter = router({
  models: publicProcedure.query(() => FAL_MODEL_OPTIONS),

  promptStyles: publicProcedure.query(() => PROMPT_STYLES),

  hooks: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: hooks.id,
        text: hooks.text,
        sceneDescriptions: hooks.sceneDescriptions,
      })
      .from(hooks)
      .where(isNotNull(hooks.sceneDescriptions))
      .orderBy(desc(hooks.score), desc(hooks.createdAt))
      .limit(20);
    return rows;
  }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(imageTests)
      .orderBy(desc(imageTests.createdAt))
      .limit(100);
  }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(imageTests).where(eq(imageTests.id, input.id));
    }),

  clearAll: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(imageTests);
  }),

  generateMatrix: publicProcedure
    .input(
      z.object({
        sceneDescription: z.string().min(1),
        models: z.array(z.string()).min(1),
        styleIds: z.array(z.string()).min(1),
        hookId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const styles = PROMPT_STYLES.filter((s) =>
        input.styleIds.includes(s.id)
      );
      const batchId = nanoid();

      const jobs = styles.flatMap((style) =>
        input.models.map((model) => ({
          style: style.id,
          model,
          prompt: buildPromptWithStyle(input.sceneDescription, style.id),
        }))
      );

      const testIds: number[] = [];

      for (const job of jobs) {
        const [row] = await ctx.db
          .insert(imageTests)
          .values({
            prompt: job.prompt,
            model: job.model,
            style: job.style,
            status: "pending",
            hookId: input.hookId,
            batchId,
          })
          .returning();
        testIds.push(row!.id);
        runImageTest(row!.id, job.prompt, job.model);
      }

      return { batchId, testIds };
    }),

  generateMultiple: publicProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        models: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const batchId = nanoid();
      const testIds: number[] = [];

      for (const model of input.models) {
        const [row] = await ctx.db
          .insert(imageTests)
          .values({
            prompt: input.prompt,
            model,
            status: "pending",
            batchId,
          })
          .returning();
        testIds.push(row!.id);
        runImageTest(row!.id, input.prompt, model);
      }

      return { batchId, testIds };
    }),
});
