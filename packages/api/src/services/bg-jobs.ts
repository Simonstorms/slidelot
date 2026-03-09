import { db } from "@marketing-ai/db";
import { bgJobs } from "@marketing-ai/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function createBgJob(
  type: "hook_generation" | "slide_generation" | "image_test",
  input: Record<string, unknown>,
  total = 0
) {
  const [job] = await db
    .insert(bgJobs)
    .values({ type, input, total, status: "pending" })
    .returning();
  return job!;
}

export async function updateBgJob(
  id: number,
  updates: {
    status?: "running" | "completed" | "failed";
    progress?: number;
    total?: number;
    error?: string;
  }
) {
  await db
    .update(bgJobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(bgJobs.id, id));
}

export async function recoverStaleBgJobs() {
  const stale = await db
    .select({ id: bgJobs.id })
    .from(bgJobs)
    .where(inArray(bgJobs.status, ["pending", "running"]));

  if (stale.length > 0) {
    await db
      .update(bgJobs)
      .set({
        status: "failed",
        error: "Server restarted during processing",
        updatedAt: new Date(),
      })
      .where(inArray(bgJobs.id, stale.map((j) => j.id)));
    console.log(`Marked ${stale.length} stale bg job(s) as failed`);
  }
}
