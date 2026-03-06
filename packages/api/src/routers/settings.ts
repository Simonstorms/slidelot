import { router, publicProcedure } from "../index";
import { settings } from "@marketing-ai/db/schema";
import { z } from "zod";

export const settingsRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(settings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }),

  upsert: publicProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(settings)
        .values({ key: input.key, value: input.value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: input.value, updatedAt: new Date() },
        });
    }),

  bulkUpsert: publicProcedure
    .input(z.record(z.string(), z.string()))
    .mutation(async ({ ctx, input }) => {
      for (const [key, value] of Object.entries(input)) {
        await ctx.db
          .insert(settings)
          .values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }),
});
