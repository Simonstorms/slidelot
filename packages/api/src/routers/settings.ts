import { router, publicProcedure } from "../index";
import { settings } from "@slidelot/db/schema";
import { z } from "zod";
import {
  getAllApiKeyStatuses,
  resetCachedClients,
} from "../services/api-keys";

const apiKeyNames = z.enum([
  "ANTHROPIC_API_KEY",
  "FAL_API_KEY",
  "POSTIZ_API_KEY",
  "POSTIZ_INTEGRATION_ID",
  "REVENUECAT_API_KEY",
]);

export const settingsRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(settings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      if (row.key.startsWith("apiKey.")) continue;
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

  getApiKeyStatuses: publicProcedure.query(async () => {
    return getAllApiKeyStatuses();
  }),

  saveApiKey: publicProcedure
    .input(z.object({ key: apiKeyNames, value: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const dbKey = `apiKey.${input.key}`;
      await ctx.db
        .insert(settings)
        .values({ key: dbKey, value: input.value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: input.value, updatedAt: new Date() },
        });
      resetCachedClients();
    }),
});
