import { router, publicProcedure } from "../index";
import { hooks } from "@slidelot/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  generateSearchQuery,
  searchPinterest,
} from "../services/pinterest";

export const pinterestRouter = router({
  search: publicProcedure
    .input(z.object({ hookId: z.number(), slideIndex: z.number() }))
    .query(async ({ ctx, input }) => {
      const [hook] = await ctx.db
        .select()
        .from(hooks)
        .where(eq(hooks.id, input.hookId));

      if (!hook) throw new Error("Hook not found");

      const slideText = hook.slideTexts?.[input.slideIndex] ?? "";
      const sceneDescription = hook.sceneDescriptions?.[input.slideIndex] ?? "";

      const query = await generateSearchQuery(slideText, sceneDescription);
      const pins = await searchPinterest(query);

      return { query, pins };
    }),

  searchCustom: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const pins = await searchPinterest(input.query);
      return { query: input.query, pins };
    }),
});
