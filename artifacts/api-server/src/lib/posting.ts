import { db } from "@workspace/db";
import { postsTable, brandConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendDiscordNotification } from "./discord.js";
import type { Post } from "@workspace/db/schema";

const META_VERSION = "v19.0";

function getMetaToken(brand: string): string | undefined {
  const map: Record<string, string | undefined> = {
    wolfpackwash: process.env.META_TOKEN_WOLFPACKWASH,
    mopmafia: process.env.META_TOKEN_MOPMAFIA,
    blueocean: process.env.META_TOKEN_BLUEOCEAN,
  };
  return map[brand];
}

async function postToFacebook(post: Post, pageId: string, token: string): Promise<string> {
  const caption = post.link_url_tagged
    ? `${post.caption}\n\n${post.link_url_tagged}`
    : post.caption;

  let url: string;
  let body: Record<string, string>;

  if (post.image_url) {
    url = `https://graph.facebook.com/${META_VERSION}/${pageId}/photos`;
    body = { url: post.image_url, caption, access_token: token };
  } else {
    url = `https://graph.facebook.com/${META_VERSION}/${pageId}/feed`;
    body = { message: caption, access_token: token };
    if (post.link_url_tagged) body.link = post.link_url_tagged;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `FB API error ${res.status}`);
  }
  return data.id ?? data.post_id ?? "";
}

async function postToInstagram(post: Post, igAccountId: string, token: string): Promise<string> {
  if (!post.image_url) {
    logger.warn({ postId: post.id }, "Instagram post skipped — no media");
    return "";
  }

  const step1Res = await fetch(`https://graph.facebook.com/${META_VERSION}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: post.image_url,
      caption: post.caption,
      access_token: token,
    }),
  });
  const step1Data = await step1Res.json() as any;
  if (!step1Res.ok || step1Data.error) {
    throw new Error(step1Data.error?.message ?? `IG media container error ${step1Res.status}`);
  }

  const containerId = step1Data.id;

  const step2Res = await fetch(`https://graph.facebook.com/${META_VERSION}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: token,
    }),
  });
  const step2Data = await step2Res.json() as any;
  if (!step2Res.ok || step2Data.error) {
    throw new Error(step2Data.error?.message ?? `IG publish error ${step2Res.status}`);
  }

  return step2Data.id ?? "";
}

async function getGBPAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GBP_CLIENT_ID ?? "",
      client_secret: process.env.GBP_CLIENT_SECRET ?? "",
      refresh_token: process.env.GBP_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? `GBP token refresh failed ${res.status}`);
  }
  return data.access_token;
}

async function postToGBP(post: Post, brandConfig: any, accessToken: string): Promise<string> {
  const locationId = brandConfig.gbp_location_id;
  if (!locationId) {
    logger.warn({ postId: post.id }, "GBP post skipped — no location ID");
    return "";
  }

  const body: any = {
    languageCode: "en",
    summary: post.caption,
    topicType: "STANDARD",
    callToAction: post.link_url_tagged
      ? { actionType: "LEARN_MORE", url: post.link_url_tagged }
      : undefined,
  };

  if (post.image_url) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: post.image_url }];
  }

  const url = `https://mybusiness.googleapis.com/v4/accounts/${locationId.split("/")[0]}/locations/${locationId}/localPosts`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `GBP post error ${res.status}`);
  }
  return data.name ?? "";
}

export async function executePost(post: Post, log: any = logger): Promise<void> {
  const timestamp = new Date().toISOString();
  log.info({ postId: post.id, brand: post.brand, platforms: post.platforms, timestamp }, "Executing post");

  await db.update(postsTable).set({ status: "posting" }).where(eq(postsTable.id, post.id));

  const [brandConfig] = await db.select().from(brandConfigTable).where(eq(brandConfigTable.brand, post.brand));
  const token = getMetaToken(post.brand);

  const results: { platform: string; success: boolean; id?: string; error?: string }[] = [];

  await Promise.all(
    post.platforms.map(async (platform) => {
      try {
        let resultId = "";

        if (platform === "facebook") {
          if (!token) throw new Error("No META token for brand");
          if (!brandConfig?.fb_page_id) throw new Error("No Facebook page ID configured");
          resultId = await postToFacebook(post, brandConfig.fb_page_id, token);
        } else if (platform === "instagram") {
          if (!token) throw new Error("No META token for brand");
          if (!brandConfig?.ig_account_id) throw new Error("No Instagram account ID configured");
          resultId = await postToInstagram(post, brandConfig.ig_account_id, token);
        } else if (platform === "gbp") {
          const gbpToken = await getGBPAccessToken();
          resultId = await postToGBP(post, brandConfig, gbpToken);
        }

        results.push({ platform, success: true, id: resultId });
        log.info({ postId: post.id, platform, resultId, timestamp }, "Platform post succeeded");
      } catch (err: any) {
        results.push({ platform, success: false, error: err.message });
        log.error({ err, postId: post.id, platform, timestamp }, "Platform post failed");
      }
    })
  );

  const allSucceeded = results.every(r => r.success);
  const anySucceeded = results.some(r => r.success);
  const fbResult = results.find(r => r.platform === "facebook");
  const igResult = results.find(r => r.platform === "instagram");
  const gbpResult = results.find(r => r.platform === "gbp");

  const errors = results.filter(r => !r.success).map(r => `${r.platform}: ${r.error}`).join("; ");

  await db.update(postsTable).set({
    status: anySucceeded ? "posted" : "failed",
    posted_at: anySucceeded ? new Date() : null,
    error_message: errors || null,
    fb_post_id: fbResult?.id ?? null,
    ig_post_id: igResult?.id ?? null,
    gbp_post_id: gbpResult?.id ?? null,
  }).where(eq(postsTable.id, post.id));

  const successPlatforms = results.filter(r => r.success).map(r => r.platform).join(", ");
  const caption = post.caption.substring(0, 100);

  if (anySucceeded) {
    await sendDiscordNotification(
      `✅ ${brandConfig?.display_name ?? post.brand} posted to ${successPlatforms} — ${post.content_type}${post.headline_variant ? ` · ${post.headline_variant}` : ""}\nCaption: ${caption}${post.caption.length > 100 ? "..." : ""}`
    );
  }

  if (!allSucceeded) {
    const failedPlatforms = results.filter(r => !r.success);
    for (const f of failedPlatforms) {
      const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "";
      await sendDiscordNotification(
        `🚨 FAILED — ${brandConfig?.display_name ?? post.brand} → ${f.platform}\nError: ${f.error}\nScheduled for: ${post.scheduled_at.toISOString()}\nFix it: https://${replitDomain}/queue`
      );
    }
  }
}
