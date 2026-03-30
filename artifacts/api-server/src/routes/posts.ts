import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, postMetricsTable } from "@workspace/db/schema";
import { eq, and, inArray, desc, asc, sql } from "drizzle-orm";
import { sendDiscordNotification } from "../lib/discord.js";
import { executePost } from "../lib/posting.js";

const router = Router();

function buildUTMUrl(url: string, platform: string, brand: string, postId: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", platform);
    u.searchParams.set("utm_medium", "social");
    u.searchParams.set("utm_brand", brand);
    u.searchParams.set("utm_content", postId);
    return u.toString();
  } catch {
    return url;
  }
}

router.get("/posts", async (req, res) => {
  try {
    const { brand, status, platform, content_type, limit = 50, offset = 0 } = req.query as Record<string, string>;

    const posts = await db.select().from(postsTable).orderBy(desc(postsTable.scheduled_at)).limit(Number(limit)).offset(Number(offset));

    let filtered = posts;
    if (brand) filtered = filtered.filter(p => p.brand === brand);
    if (status) {
      const statuses = status.split(",");
      filtered = filtered.filter(p => statuses.includes(p.status));
    }
    if (platform) filtered = filtered.filter(p => p.platforms.includes(platform));
    if (content_type) filtered = filtered.filter(p => p.content_type === content_type);

    res.json({ posts: filtered, total: filtered.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list posts");
    res.status(500).json({ error: "Failed to list posts" });
  }
});

router.post("/posts", async (req, res) => {
  try {
    const body = req.body;
    const { brand, platforms, caption, image_url, video_url, media_format, link_url, content_type, headline_variant, instagram_format, scheduled_at, post_now } = body;

    if (!brand || !platforms || !caption || !content_type || !scheduled_at) {
      return res.status(400).json({ error: "Missing required fields: brand, platforms, caption, content_type, scheduled_at" });
    }

    const scheduledDate = new Date(scheduled_at);

    const [post] = await db.insert(postsTable).values({
      brand,
      platforms,
      caption,
      image_url: image_url || null,
      video_url: video_url || null,
      media_format: media_format || "text",
      link_url: link_url || null,
      link_url_tagged: null,
      content_type,
      headline_variant: headline_variant || null,
      instagram_format: instagram_format || "feed",
      scheduled_at: scheduledDate,
      status: "scheduled",
    }).returning();

    if (link_url && post) {
      const tagged = buildUTMUrl(link_url, platforms[0] || "social", brand, post.id);
      await db.update(postsTable).set({ link_url_tagged: tagged }).where(eq(postsTable.id, post.id));
      post.link_url_tagged = tagged;
    }

    if (post_now && post) {
      req.log.info({ postId: post.id }, "Immediate post requested, executing now");
      executePost(post, req.log).catch(err => {
        req.log.error({ err, postId: post.id }, "Async immediate post failed");
      });
    }

    res.status(201).json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.get("/posts/:id", async (req, res) => {
  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to get post");
    res.status(500).json({ error: "Failed to get post" });
  }
});

router.delete("/posts/:id", async (req, res) => {
  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.status !== "scheduled") {
      return res.status(400).json({ error: "Can only cancel scheduled posts" });
    }
    await db.delete(postsTable).where(eq(postsTable.id, req.params.id));
    res.json({ success: true, message: "Post cancelled" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete post");
    res.status(500).json({ error: "Failed to delete post" });
  }
});

router.get("/posts/:id/metrics", async (req, res) => {
  try {
    const metrics = await db.select().from(postMetricsTable)
      .where(eq(postMetricsTable.post_id, req.params.id))
      .orderBy(desc(postMetricsTable.fetched_at));
    res.json(metrics);
  } catch (err) {
    req.log.error({ err }, "Failed to get post metrics");
    res.status(500).json({ error: "Failed to get post metrics" });
  }
});

export default router;
