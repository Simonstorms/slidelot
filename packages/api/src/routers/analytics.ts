import { router, publicProcedure } from "../index";
import {
  analytics,
  posts,
  hooks,
  learnings,
  settings,
} from "@marketing-ai/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getPostAnalytics } from "../services/postiz";
import { getConversionMetrics } from "../services/revenuecat";
import {
  runDiagnosis,
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

export const analyticsRouter = router({
  dashboard: publicProcedure.query(async ({ ctx }) => {
    const allAnalytics = await ctx.db.select().from(analytics);
    const allPosts = await ctx.db.select().from(posts);

    const totalViews = allAnalytics.reduce((sum, a) => sum + (a.views ?? 0), 0);
    const totalLikes = allAnalytics.reduce((sum, a) => sum + (a.likes ?? 0), 0);
    const totalConversions = allAnalytics.reduce(
      (sum, a) => sum + (a.conversions ?? 0),
      0
    );
    const totalRevenue = allAnalytics.reduce(
      (sum, a) => sum + (a.revenue ?? 0),
      0
    );

    const postedCount = allPosts.filter((p) => p.status === "posted").length;
    const avgViews = postedCount > 0 ? Math.round(totalViews / postedCount) : 0;

    const pendingCount = allPosts.filter((p) => p.status === "pending").length;

    const winnerHooks = await ctx.db
      .select()
      .from(hooks)
      .where(eq(hooks.status, "winner"));

    const allHooksWithStatus = await ctx.db
      .select()
      .from(hooks)
      .where(
        sql`${hooks.status} IN ('winner', 'loser')`
      );

    const winRate =
      allHooksWithStatus.length > 0
        ? Math.round((winnerHooks.length / allHooksWithStatus.length) * 100)
        : 0;

    const topPosts = await ctx.db
      .select({
        post: posts,
        hookText: hooks.text,
        views: analytics.views,
        conversions: analytics.conversions,
      })
      .from(posts)
      .leftJoin(hooks, eq(posts.hookId, hooks.id))
      .leftJoin(analytics, eq(analytics.postId, posts.id))
      .where(eq(posts.status, "posted"))
      .orderBy(desc(analytics.views))
      .limit(5);

    const learningsCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(learnings);

    return {
      totalViews,
      totalLikes,
      totalConversions,
      totalRevenue,
      avgViews,
      postedCount,
      pendingCount,
      winRate,
      topPosts,
      learningsCount: learningsCount[0]?.count ?? 0,
    };
  }),

  pull: publicProcedure.mutation(async ({ ctx }) => {
    const postedPosts = await ctx.db
      .select()
      .from(posts)
      .where(eq(posts.status, "posted"));

    let updated = 0;

    for (const post of postedPosts) {
      if (!post.postizId) continue;

      try {
        const data = await getPostAnalytics(post.postizId);

        const existing = await ctx.db
          .select()
          .from(analytics)
          .where(eq(analytics.postId, post.id));

        const conversionData = await getConversionMetrics();

        if (existing.length > 0) {
          await ctx.db
            .update(analytics)
            .set({
              views: data.views,
              likes: data.likes,
              comments: data.comments,
              shares: data.shares,
              downloads: conversionData?.downloads ?? 0,
              trials: conversionData?.trials ?? 0,
              conversions: conversionData?.conversions ?? 0,
              revenue: conversionData?.revenue ?? 0,
              pulledAt: new Date(),
            })
            .where(eq(analytics.postId, post.id));
        } else {
          await ctx.db.insert(analytics).values({
            postId: post.id,
            views: data.views,
            likes: data.likes,
            comments: data.comments,
            shares: data.shares,
            downloads: conversionData?.downloads ?? 0,
            trials: conversionData?.trials ?? 0,
            conversions: conversionData?.conversions ?? 0,
            revenue: conversionData?.revenue ?? 0,
          });
        }

        await ctx.db
          .update(hooks)
          .set({ viewCount: data.views, updatedAt: new Date() })
          .where(eq(hooks.id, post.hookId));

        updated++;
      } catch (error) {
        console.error(`Failed to pull analytics for post ${post.id}:`, error);
      }
    }

    return { updated };
  }),

  diagnosis: publicProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select({
        post: posts,
        hook: hooks,
        analytics: analytics,
      })
      .from(posts)
      .leftJoin(hooks, eq(posts.hookId, hooks.id))
      .leftJoin(analytics, eq(analytics.postId, posts.id))
      .where(eq(posts.status, "posted"));

    const views = results
      .map((r) => r.analytics?.views ?? 0)
      .sort((a, b) => a - b);
    const conversions = results
      .map((r) => r.analytics?.conversions ?? 0)
      .sort((a, b) => a - b);

    const medianViews = views[Math.floor(views.length / 2)] ?? 0;
    const medianConversions =
      conversions[Math.floor(conversions.length / 2)] ?? 0;

    return {
      medianViews,
      medianConversions,
      quadrants: {
        winner: results.filter(
          (r) =>
            (r.analytics?.views ?? 0) >= medianViews &&
            (r.analytics?.conversions ?? 0) >= medianConversions
        ).length,
        wrong_audience: results.filter(
          (r) =>
            (r.analytics?.views ?? 0) >= medianViews &&
            (r.analytics?.conversions ?? 0) < medianConversions
        ).length,
        weak_hook: results.filter(
          (r) =>
            (r.analytics?.views ?? 0) < medianViews &&
            (r.analytics?.conversions ?? 0) >= medianConversions
        ).length,
        dud: results.filter(
          (r) =>
            (r.analytics?.views ?? 0) < medianViews &&
            (r.analytics?.conversions ?? 0) < medianConversions
        ).length,
      },
      posts: results.map((r) => ({
        postId: r.post.id,
        hookText: r.hook?.text ?? "",
        views: r.analytics?.views ?? 0,
        likes: r.analytics?.likes ?? 0,
        comments: r.analytics?.comments ?? 0,
        shares: r.analytics?.shares ?? 0,
        conversions: r.analytics?.conversions ?? 0,
        quadrant:
          (r.analytics?.views ?? 0) >= medianViews
            ? (r.analytics?.conversions ?? 0) >= medianConversions
              ? ("winner" as const)
              : ("wrong_audience" as const)
            : (r.analytics?.conversions ?? 0) >= medianConversions
              ? ("weak_hook" as const)
              : ("dud" as const),
      })),
    };
  }),

  report: publicProcedure.mutation(async ({ ctx }) => {
    const s = await getSettingsFromDb(ctx.db);

    const allResults = await ctx.db
      .select({
        post: posts,
        hook: hooks,
        analytics: analytics,
      })
      .from(posts)
      .leftJoin(hooks, eq(posts.hookId, hooks.id))
      .leftJoin(analytics, eq(analytics.postId, posts.id))
      .where(eq(posts.status, "posted"));

    if (allResults.length === 0) {
      return {
        postsAnalyzed: 0,
        winnersFound: 0,
        failuresLogged: 0,
        learningsCreated: 0,
      };
    }

    const views = allResults
      .map((r) => r.analytics?.views ?? 0)
      .sort((a, b) => a - b);
    const conversions = allResults
      .map((r) => r.analytics?.conversions ?? 0)
      .sort((a, b) => a - b);

    const medianViews = views[Math.floor(views.length / 2)] ?? 0;
    const medianConversions =
      conversions[Math.floor(conversions.length / 2)] ?? 0;

    const postsForDiagnosis = allResults.map((r) => ({
      hookText: r.hook?.text ?? "",
      slideTexts: (r.hook?.slideTexts as string[]) ?? [],
      views: r.analytics?.views ?? 0,
      likes: r.analytics?.likes ?? 0,
      comments: r.analytics?.comments ?? 0,
      shares: r.analytics?.shares ?? 0,
      conversions: r.analytics?.conversions ?? 0,
    }));

    const diagnosisResults = await runDiagnosis(
      postsForDiagnosis,
      medianViews,
      medianConversions,
      s
    );

    let winnersFound = 0;
    let failuresLogged = 0;
    let learningsCreated = 0;

    for (let i = 0; i < diagnosisResults.length; i++) {
      const diagnosis = diagnosisResults[i];
      const hookData = allResults[i]?.hook;

      if (!hookData || !diagnosis) continue;

      if (diagnosis.quadrant === "winner") {
        await ctx.db
          .update(hooks)
          .set({ status: "winner", updatedAt: new Date() })
          .where(eq(hooks.id, hookData.id));
        winnersFound++;

        try {
          const variations = await generateWinnerVariations(hookData.id, s);
          for (const v of variations) {
            await ctx.db.insert(hooks).values({
              text: v.text,
              formula: v.formula,
              slideTexts: v.slideTexts,
              sceneDescription: v.sceneDescription,
              parentHookId: hookData.id,
              status: "draft",
            });
          }
        } catch (error) {
          console.error("Failed to generate variations:", error);
        }
      } else if (diagnosis.quadrant === "dud") {
        await ctx.db
          .update(hooks)
          .set({ status: "loser", updatedAt: new Date() })
          .where(eq(hooks.id, hookData.id));

        await ctx.db.insert(learnings).values({
          type: "failure",
          content: `Hook "${hookData.text}" failed: ${diagnosis.diagnosis}`,
          source: "auto",
          hookId: hookData.id,
        });
        failuresLogged++;
      } else {
        await ctx.db
          .update(hooks)
          .set({ status: "loser", updatedAt: new Date() })
          .where(eq(hooks.id, hookData.id));
      }

      for (const learning of diagnosis.newLearnings) {
        await ctx.db.insert(learnings).values({
          type: "rule",
          content: learning,
          source: "auto",
          hookId: hookData.id,
        });
        learningsCreated++;
      }
    }

    return {
      postsAnalyzed: allResults.length,
      winnersFound,
      failuresLogged,
      learningsCreated,
    };
  }),
});
