import { router, publicProcedure } from "../index";
import { bgJobs } from "@marketing-ai/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { z } from "zod";

export const bgJobsRouter = router({
  status: publicProcedure
    .input(z.object({ jobIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => {
      if (input.jobIds.length === 0) return [];
      return ctx.db
        .select()
        .from(bgJobs)
        .where(inArray(bgJobs.id, input.jobIds));
    }),

  get: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const [job] = await ctx.db
        .select()
        .from(bgJobs)
        .where(eq(bgJobs.id, input.jobId));
      return job ?? null;
    }),

  active: publicProcedure
    .input(z.object({ type: z.enum(["hook_generation", "slide_generation", "image_test"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(bgJobs)
        .where(
          and(
            eq(bgJobs.type, input.type),
            inArray(bgJobs.status, ["pending", "running"])
          )
        )
        .orderBy(desc(bgJobs.createdAt));
    }),
});
