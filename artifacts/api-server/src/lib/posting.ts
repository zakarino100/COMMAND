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

// ─── Facebook ─────────────────────────────────────────────────────────────────

async function postToFacebook(post: Post, pageId: string, token: string): Promise<string> {
  const caption = post.link_url_tagged
    ? `${post.caption}\n\n${post.link_url_tagged}`
    : post.caption;

  // Video post
  if (post.video_url) {
    const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: post.video_url,
        description: caption,
        published: true,
        access_token: token,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `FB video error ${res.status}`);
    }
    return data.id ?? "";
  }

  // Image post
  if (post.image_url) {
    const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: post.image_url, caption, access_token: token }),
    });
    const data = await res.json() as any;
    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `FB photo error ${res.status}`);
    }
    return data.id ?? data.post_id ?? "";
  }

  // Text-only post
  const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: caption,
      access_token: token,
      ...(post.link_url_tagged ? { link: post.link_url_tagged } : {}),
    }),
  });
  const data = await res.json() as any;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `FB feed error ${res.status}`);
  }
  return data.id ?? "";
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/** Poll IG container until it finishes processing (needed for video) */
async function waitForIGContainer(containerId: string, token: string): Promise<void> {
  const MAX_ATTEMPTS = 24; // up to ~2 minutes
  const POLL_MS = 5000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${containerId}?fields=status_code&access_token=${token}`
    );
    const data = await res.json() as any;
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Instagram container processing failed: ${data.status_code}`);
    }
  }
  throw new Error("Instagram video processing timed out after 2 minutes");
}

async function postToInstagram(post: Post, igAccountId: string, token: string): Promise<string> {
  // Instagram requires media for all posts
  if (!post.image_url && !post.video_url) {
    logger.warn({ postId: post.id }, "Instagram post skipped — no media");
    return "";
  }

  const isVideo = !!post.video_url;
  const isReel = post.instagram_format === "reel";

  let containerBody: Record<string, any>;

  if (isVideo) {
    containerBody = {
      video_url: post.video_url,
      caption: post.caption,
      access_token: token,
      ...(isReel
        ? { media_type: "REELS", share_to_feed: true }
        : { media_type: "VIDEO" }),
    };
  } else {
    containerBody = {
      image_url: post.image_url,
      caption: post.caption,
      access_token: token,
    };
  }

  // Step 1: Create container
  const step1Res = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    }
  );
  const step1Data = await step1Res.json() as any;
  if (!step1Res.ok || step1Data.error) {
    throw new Error(step1Data.error?.message ?? `IG container error ${step1Res.status}`);
  }

  const containerId = step1Data.id;

  // Step 2: Poll until video is ready (skip for images)
  if (isVideo) {
    await waitForIGContainer(containerId, token);
  }

  // Step 3: Publish
  const step2Res = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${igAccountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    }
  );
  const step2Data = await step2Res.json() as any;
  if (!step2Res.ok || step2Data.error) {
    throw new Error(step2Data.error?.message ?? `IG publish error ${step2Res.status}`);
  }

  return step2Data.id ?? "";
}

// ─── Google Business Profile ──────────────────────────────────────────────────

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

  // GBP only supports photos, not video
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

// ─── Execute ──────────────────────────────────────────────────────────────────

export async function executePost(post: Post, log: any = logger): Promise<void> {
  const timestamp = new Date().toISOString();

  const [brandConfig] = await db
    .select()
    .from(brandConfigTable)
    .where(eq(brandConfigTable.brand, post.brand));

  if (!brandConfig) {
    throw new Error(`No brand config found for brand: ${post.brand}`);
  }

  const metaToken = getMetaToken(post.brand);
  const results: { platform: string; id: string }[] = [];
  const errors: { platform: string; error: string }[] = [];

  for (const platform of post.platforms) {
    try {
      let resultId = "";

      if (platform === "facebook") {
        if (!metaToken || !brandConfig.fb_page_id) {
          throw new Error("Missing Meta token or Facebook Page ID");
        }
        resultId = await postToFacebook(post, brandConfig.fb_page_id, metaToken);

      } else if (platform === "instagram") {
        if (!metaToken || !brandConfig.ig_account_id) {
          throw new Error("Missing Meta token or Instagram Account ID");
        }
        resultId = await postToInstagram(post, brandConfig.ig_account_id, metaToken);

      } else if (platform === "google") {
        const gbpToken = await getGBPAccessToken();
        resultId = await postToGBP(post, brandConfig, gbpToken);
      }

      results.push({ platform, id: resultId });
      log.info({ postId: post.id, platform, resultId }, `Posted to ${platform}`);
    } catch (err: any) {
      errors.push({ platform, error: err.message });
      log.error({ err, postId: post.id, platform }, `Failed to post to ${platform}`);
    }
  }

  const fbResult = results.find((r) => r.platform === "facebook");
  const igResult = results.find((r) => r.platform === "instagram");
  const gbpResult = results.find((r) => r.platform === "google");

  const allFailed = errors.length === post.platforms.length;
  const someSucceeded = results.length > 0;

  await db
    .update(postsTable)
    .set({
      status: allFailed ? "failed" : "posted",
      posted_at: new Date(),
      fb_post_id: fbResult?.id ?? null,
      ig_post_id: igResult?.id ?? null,
      gbp_post_id: gbpResult?.id ?? null,
      error_message: errors.length > 0
        ? errors.map((e) => `${e.platform}: ${e.error}`).join("; ")
        : null,
    })
    .where(eq(postsTable.id, post.id));

  if (someSucceeded) {
    await sendDiscordNotification({
      type: "success",
      brand: post.brand,
      platforms: results.map((r) => r.platform),
      caption: post.caption,
      postId: post.id,
      errors: errors.length > 0 ? errors : undefined,
    });
  } else {
    await sendDiscordNotification({
      type: "failure",
      brand: post.brand,
      platforms: post.platforms,
      caption: post.caption,
      postId: post.id,
      errors,
    });
  }
}
