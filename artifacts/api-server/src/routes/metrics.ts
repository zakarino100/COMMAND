import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, postMetricsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, desc, sql, avg } from "drizzle-orm";

const router = Router();

const GENERIC_BEST_TIMES = [
  { day: "Tuesday", hour: 19, label: "Tue 7pm", isGeneric: true },
  { day: "Wednesday", hour: 11, label: "Wed 11am", isGeneric: true },
  { day: "Thursday", hour: 13, label: "Thu 1pm", isGeneric: true },
  { day: "Saturday", hour: 10, label: "Sat 10am", isGeneric: true },
];

router.get("/metrics/summary", async (req, res) => {
  try {
    const { brand, platform, content_type, date_from, date_to } = req.query as Record<string, string>;

    let postsQuery = db.select().from(postsTable).where(eq(postsTable.status, "posted"));
    const posts = await postsQuery;

    let filtered = posts;
    if (brand) filtered = filtered.filter(p => p.brand === brand);
    if (platform) filtered = filtered.filter(p => p.platforms.includes(platform));
    if (content_type) filtered = filtered.filter(p => p.content_type === content_type);
    if (date_from) filtered = filtered.filter(p => p.posted_at && new Date(p.posted_at) >= new Date(date_from));
    if (date_to) filtered = filtered.filter(p => p.posted_at && new Date(p.posted_at) <= new Date(date_to));

    const postIds = filtered.map(p => p.id);

    let metrics: any[] = [];
    if (postIds.length > 0) {
      metrics = await db.select().from(postMetricsTable)
        .where(sql`${postMetricsTable.post_id} = ANY(${sql`ARRAY[${sql.join(postIds.map(id => sql`${id}::uuid`), sql`, `)}]`})`);
    }

    const avgEngagement = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.engagement_rate, 0) / metrics.length
      : 0;

    const platformCounts: Record<string, number> = {};
    const platformEngagement: Record<string, number[]> = {};
    metrics.forEach(m => {
      if (!platformEngagement[m.platform]) platformEngagement[m.platform] = [];
      platformEngagement[m.platform].push(m.engagement_rate);
    });

    let bestPlatform: string | null = null;
    let bestPlatformAvg = -1;
    for (const [plt, rates] of Object.entries(platformEngagement)) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (avg > bestPlatformAvg) {
        bestPlatformAvg = avg;
        bestPlatform = plt;
      }
    }

    const contentTypeEngagement: Record<string, number[]> = {};
    filtered.forEach(post => {
      const postMetrics = metrics.filter(m => m.post_id === post.id);
      const avgRate = postMetrics.length > 0
        ? postMetrics.reduce((sum, m) => sum + m.engagement_rate, 0) / postMetrics.length
        : 0;
      if (!contentTypeEngagement[post.content_type]) contentTypeEngagement[post.content_type] = [];
      contentTypeEngagement[post.content_type].push(avgRate);
    });

    let bestContentType: string | null = null;
    let bestContentTypeAvg = -1;
    for (const [ct, rates] of Object.entries(contentTypeEngagement)) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (avg > bestContentTypeAvg) {
        bestContentTypeAvg = avg;
        bestContentType = ct;
      }
    }

    const rankedPosts = filtered.map(post => {
      const postMetrics = metrics.filter(m => m.post_id === post.id);
      const totalLikes = postMetrics.reduce((sum, m) => sum + m.likes, 0);
      const totalComments = postMetrics.reduce((sum, m) => sum + m.comments, 0);
      const totalReach = postMetrics.reduce((sum, m) => sum + m.reach, 0);
      const avgRate = postMetrics.length > 0
        ? postMetrics.reduce((sum, m) => sum + m.engagement_rate, 0) / postMetrics.length
        : 0;
      return {
        id: post.id,
        brand: post.brand,
        platform: post.platforms.join(", "),
        content_type: post.content_type,
        headline_variant: post.headline_variant,
        reach: totalReach,
        likes: totalLikes,
        comments: totalComments,
        engagement_rate: avgRate,
        posted_at: post.posted_at?.toISOString() ?? null,
      };
    }).sort((a, b) => b.engagement_rate - a.engagement_rate);

    res.json({
      totalPosts: filtered.length,
      avgEngagementRate: avgEngagement,
      bestPlatform,
      bestContentType,
      rankedPosts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get metrics summary");
    res.status(500).json({ error: "Failed to get metrics summary" });
  }
});

router.get("/metrics/insights", async (req, res) => {
  try {
    const { brand } = req.query as Record<string, string>;

    const posts = await db.select().from(postsTable).where(eq(postsTable.status, "posted"));
    const filtered = brand ? posts.filter(p => p.brand === brand) : posts;

    if (filtered.length < 5) {
      return res.json({ insights: ["Keep posting — your first insights will appear after a few posts."] });
    }

    const postIds = filtered.map(p => p.id);
    let metrics: any[] = [];
    if (postIds.length > 0) {
      metrics = await db.select().from(postMetricsTable)
        .where(sql`${postMetricsTable.post_id} = ANY(${sql`ARRAY[${sql.join(postIds.map(id => sql`${id}::uuid`), sql`, `)}]`})`);
    }

    const insights: string[] = [];

    const contentTypeAvg: Record<string, number[]> = {};
    filtered.forEach(post => {
      const postMetrics = metrics.filter(m => m.post_id === post.id);
      const avg = postMetrics.length > 0
        ? postMetrics.reduce((sum, m) => sum + m.engagement_rate, 0) / postMetrics.length
        : 0;
      if (!contentTypeAvg[post.content_type]) contentTypeAvg[post.content_type] = [];
      contentTypeAvg[post.content_type].push(avg);
    });

    const ctAverages = Object.entries(contentTypeAvg)
      .map(([ct, rates]) => ({ ct, avg: rates.reduce((a, b) => a + b, 0) / rates.length }))
      .sort((a, b) => b.avg - a.avg);

    if (ctAverages.length >= 2) {
      const best = ctAverages[0];
      const worst = ctAverages[ctAverages.length - 1];
      if (worst.avg > 0) {
        const mult = Math.round(best.avg / worst.avg * 10) / 10;
        insights.push(`${best.ct.replace(/_/g, " ")} posts get ${mult}x more engagement than ${worst.ct.replace(/_/g, " ")} posts.`);
      }
    }

    const platformAvg: Record<string, number[]> = {};
    metrics.forEach(m => {
      if (!platformAvg[m.platform]) platformAvg[m.platform] = [];
      platformAvg[m.platform].push(m.engagement_rate);
    });

    const platformAverages = Object.entries(platformAvg)
      .map(([plt, rates]) => ({ plt, avg: rates.reduce((a, b) => a + b, 0) / rates.length }))
      .sort((a, b) => b.avg - a.avg);

    if (platformAverages.length >= 1) {
      insights.push(`Your best performing platform is ${platformAverages[0].plt} with ${(platformAverages[0].avg * 100).toFixed(1)}% average engagement.`);
    }

    if (!brand && filtered.length >= 2) {
      const brandAvg: Record<string, number[]> = {};
      filtered.forEach(post => {
        const postMetrics = metrics.filter(m => m.post_id === post.id);
        const avg = postMetrics.length > 0
          ? postMetrics.reduce((sum, m) => sum + m.engagement_rate, 0) / postMetrics.length
          : 0;
        if (!brandAvg[post.brand]) brandAvg[post.brand] = [];
        brandAvg[post.brand].push(avg);
      });
      const brandAverages = Object.entries(brandAvg)
        .map(([b, rates]) => ({ b, avg: rates.reduce((a, b) => a + b, 0) / rates.length }))
        .sort((a, b) => b.avg - a.avg);
      if (brandAverages.length >= 2) {
        const top = brandAverages[0];
        const second = brandAverages[1];
        if (second.avg > 0) {
          const pct = Math.round((top.avg - second.avg) / second.avg * 100);
          insights.push(`${top.b} outperforms ${second.b} by ${pct}% this period.`);
        }
      }
    }

    if (insights.length === 0) {
      insights.push("Keep posting to see performance insights here.");
    }

    res.json({ insights: insights.slice(0, 3) });
  } catch (err) {
    req.log.error({ err }, "Failed to get insights");
    res.status(500).json({ error: "Failed to get insights" });
  }
});

router.get("/metrics/heatmap", async (req, res) => {
  try {
    const { brand } = req.query as Record<string, string>;

    const posts = await db.select().from(postsTable).where(eq(postsTable.status, "posted"));
    const filtered = brand ? posts.filter(p => p.brand === brand) : posts;

    if (filtered.length < 10) {
      return res.json({ data: [], hasEnoughData: false });
    }

    const postIds = filtered.map(p => p.id);
    let metrics: any[] = [];
    if (postIds.length > 0) {
      metrics = await db.select().from(postMetricsTable)
        .where(sql`${postMetricsTable.post_id} = ANY(${sql`ARRAY[${sql.join(postIds.map(id => sql`${id}::uuid`), sql`, `)}]`})`);
    }

    const cellData: Record<string, { total: number; count: number }> = {};

    filtered.forEach(post => {
      if (!post.posted_at) return;
      const d = new Date(post.posted_at);
      const day = d.getDay();
      const hour = d.getHours();
      const key = `${day}-${hour}`;
      const postMetrics = metrics.filter(m => m.post_id === post.id);
      const avg = postMetrics.length > 0
        ? postMetrics.reduce((sum, m) => sum + m.engagement_rate, 0) / postMetrics.length
        : 0;
      if (!cellData[key]) cellData[key] = { total: 0, count: 0 };
      cellData[key].total += avg;
      cellData[key].count += 1;
    });

    const data = Object.entries(cellData).map(([key, val]) => {
      const [day, hour] = key.split("-").map(Number);
      return { day, hour, avgEngagement: val.total / val.count, postCount: val.count };
    });

    res.json({ data, hasEnoughData: true });
  } catch (err) {
    req.log.error({ err }, "Failed to get heatmap");
    res.status(500).json({ error: "Failed to get heatmap" });
  }
});

router.get("/metrics/best-times", async (req, res) => {
  try {
    const { brand } = req.query as Record<string, string>;

    const posts = await db.select().from(postsTable).where(eq(postsTable.status, "posted"));
    const filtered = brand ? posts.filter(p => p.brand === brand) : posts;

    if (filtered.length < 10) {
      return res.json({ times: GENERIC_BEST_TIMES, hasEnoughData: false });
    }

    const postIds = filtered.map(p => p.id);
    let metrics: any[] = [];
    if (postIds.length > 0) {
      metrics = await db.select().from(postMetricsTable)
        .where(sql`${postMetricsTable.post_id} = ANY(${sql`ARRAY[${sql.join(postIds.map(id => sql`${id}::uuid`), sql`, `)}]`})`);
    }

    const slotData: Record<string, { total: number; count: number; day: number; hour: number }> = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    filtered.forEach(post => {
      if (!post.posted_at) return;
      const d = new Date(post.posted_at);
      const day = d.getDay();
      const hour = d.getHours();
      const key = `${day}-${hour}`;
      const postMetrics = metrics.filter(m => m.post_id === post.id);
      const avg = postMetrics.length > 0
        ? postMetrics.reduce((sum, m) => sum + m.engagement_rate, 0) / postMetrics.length
        : 0;
      if (!slotData[key]) slotData[key] = { total: 0, count: 0, day, hour };
      slotData[key].total += avg;
      slotData[key].count += 1;
    });

    const ranked = Object.values(slotData)
      .map(s => ({ ...s, avg: s.total / s.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map(s => ({
        day: dayNames[s.day],
        hour: s.hour,
        label: `${dayNames[s.day]} ${s.hour === 0 ? "12am" : s.hour < 12 ? `${s.hour}am` : s.hour === 12 ? "12pm" : `${s.hour - 12}pm`}`,
        isGeneric: false,
      }));

    res.json({ times: ranked, hasEnoughData: true });
  } catch (err) {
    req.log.error({ err }, "Failed to get best times");
    res.status(500).json({ error: "Failed to get best times" });
  }
});

export default router;
