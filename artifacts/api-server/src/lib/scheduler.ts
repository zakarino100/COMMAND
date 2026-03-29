import cron from "node-cron";
import { db } from "@workspace/db";
import { postsTable, postMetricsTable } from "@workspace/db/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { executePost } from "./posting.js";
import { sendDiscordNotification } from "./discord.js";

const META_VERSION = "v19.0";

function getMetaToken(brand: string): string | undefined {
  const map: Record<string, string | undefined> = {
    wolfpackwash: process.env.META_TOKEN_WOLFPACKWASH,
    mopmafia: process.env.META_TOKEN_MOPMAFIA,
    blueocean: process.env.META_TOKEN_BLUEOCEAN,
  };
  return map[brand];
}

async function fetchMetaMetrics(postId: string, token: string): Promise<{
  likes: number; comments: number; shares: number; reach: number; impressions: number; clicks: number;
}> {
  try {
    const [insightsRes, engRes] = await Promise.all([
      fetch(`https://graph.facebook.com/${META_VERSION}/${postId}/insights?metric=impressions,reach,post_clicks&access_token=${token}`),
      fetch(`https://graph.facebook.com/${META_VERSION}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${token}`),
    ]);

    const insightsData = await insightsRes.json() as any;
    const engData = await engRes.json() as any;

    const metrics: Record<string, number> = {};
    if (insightsData.data) {
      for (const item of insightsData.data) {
        metrics[item.name] = item.values?.[0]?.value ?? 0;
      }
    }

    return {
      likes: engData.likes?.summary?.total_count ?? 0,
      comments: engData.comments?.summary?.total_count ?? 0,
      shares: engData.shares?.count ?? 0,
      reach: metrics.reach ?? 0,
      impressions: metrics.impressions ?? 0,
      clicks: metrics.post_clicks ?? 0,
    };
  } catch {
    return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
  }
}

export function startScheduler(): void {
  // Job 1: Post scheduler — every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    const now = new Date();
    logger.info({ timestamp: now.toISOString() }, "Scheduler: checking for due posts");

    try {
      const duePosts = await db.select().from(postsTable).where(
        and(
          lte(postsTable.scheduled_at, now),
          eq(postsTable.status, "scheduled")
        )
      );

      if (duePosts.length === 0) {
        logger.info("Scheduler: no posts due");
        return;
      }

      logger.info({ count: duePosts.length }, "Scheduler: found posts to execute");

      for (const post of duePosts) {
        await executePost(post, logger);
      }
    } catch (err) {
      logger.error({ err }, "Scheduler: error processing due posts");
    }
  });

  // Job 2: Metrics sync — every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    logger.info({ timestamp: now.toISOString() }, "Metrics sync: starting");

    try {
      const posts = await db.select().from(postsTable).where(
        and(
          eq(postsTable.status, "posted"),
          gte(postsTable.posted_at, thirtyDaysAgo)
        )
      );

      logger.info({ count: posts.length }, "Metrics sync: syncing posts");

      for (const post of posts) {
        for (const platform of post.platforms) {
          const token = getMetaToken(post.brand);
          if (!token) continue;

          let postPlatformId: string | null = null;
          if (platform === "facebook") postPlatformId = post.fb_post_id;
          else if (platform === "instagram") postPlatformId = post.ig_post_id;

          if (!postPlatformId) continue;

          try {
            const metrics = await fetchMetaMetrics(postPlatformId, token);
            const engagementRate = metrics.reach > 0
              ? (metrics.likes + metrics.comments + metrics.shares) / metrics.reach
              : 0;

            await db.insert(postMetricsTable).values({
              post_id: post.id,
              platform,
              fetched_at: now,
              ...metrics,
              engagement_rate: engagementRate,
            }).onConflictDoNothing();

            logger.info({ postId: post.id, platform, engagementRate }, "Metrics sync: updated");
          } catch (err) {
            logger.error({ err, postId: post.id, platform }, "Metrics sync: failed for post/platform");
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Metrics sync: error");
    }
  });

  // Job 3: Weekly digest — Mondays 8am ET (1pm UTC)
  cron.schedule("0 13 * * 1", async () => {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekStart = weekAgo.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
      const weekEnd = now.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

      const posts = await db.select().from(postsTable).where(
        and(eq(postsTable.status, "posted"), gte(postsTable.posted_at, weekAgo))
      );

      const metrics = posts.length > 0
        ? await db.select().from(postMetricsTable)
            .where(sql`${postMetricsTable.post_id} = ANY(${sql`ARRAY[${sql.join(posts.map(p => sql`${p.id}::uuid`), sql`, `)}]`})`)
        : [];

      const avgEngagement = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.engagement_rate, 0) / metrics.length
        : 0;

      const platformCounts: Record<string, number[]> = {};
      metrics.forEach(m => {
        if (!platformCounts[m.platform]) platformCounts[m.platform] = [];
        platformCounts[m.platform].push(m.engagement_rate);
      });

      let topPlatform = "N/A";
      let topPlatformAvg = -1;
      for (const [plt, rates] of Object.entries(platformCounts)) {
        const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
        if (avg > topPlatformAvg) { topPlatformAvg = avg; topPlatform = plt; }
      }

      const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "";
      await sendDiscordNotification(
        `📊 Weekly Wrap — ${weekStart}–${weekEnd}\nPosts: ${posts.length} | Avg engagement: ${(avgEngagement * 100).toFixed(1)}% | Top platform: ${topPlatform}\nhttps://${replitDomain}/performance`
      );
    } catch (err) {
      logger.error({ err }, "Weekly digest: failed");
    }
  });

  logger.info("Scheduler: all cron jobs started");
}
