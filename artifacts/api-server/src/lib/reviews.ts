import { db } from "@workspace/db";
import { reviewsTable, brandConfigTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger.js";

const OUTSCRAPER_API_URL = "https://api.outscraper.cloud/maps/reviews-v3";
const FIVE_STAR_RATING = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutscraperReview {
  review_id: string;
  author_title: string;
  author_image: string | null;
  review_rating: number;
  review_text: string | null;
  review_datetime_utc: string | null;
}

interface OutscraperResponse {
  status: string;
  data: OutscraperReview[][];
}

// ─── Fetch from Outscraper (async job polling) ───────────────────────────────

const POLL_INTERVAL_MS = 3000;  // poll every 3 seconds
const POLL_MAX_ATTEMPTS = 40;   // max ~2 minutes

async function pollForResults(resultsUrl: string, apiKey: string): Promise<OutscraperReview[]> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(resultsUrl, {
      headers: { "X-API-KEY": apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Outscraper poll error ${res.status}: ${text}`);
    }

    const data = await res.json() as OutscraperResponse;
    logger.info({ attempt, status: data.status }, "Outscraper poll");

    if (data.status === "Success") {
      const raw = data.data?.[0];
      logger.info({ rawType: typeof raw, isArray: Array.isArray(raw), sample: JSON.stringify(raw)?.slice(0, 500) }, "Outscraper result structure");
      // data.data[0] may be an object with a reviews array, or an array of reviews directly
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray((raw as any).reviews)) return (raw as any).reviews;
      if (raw && typeof raw === 'object') {
        // Try to find any array property that looks like reviews
        const keys = Object.keys(raw as object);
        logger.info({ keys }, "Outscraper result keys");
        for (const key of keys) {
          if (Array.isArray((raw as any)[key])) return (raw as any)[key];
        }
      }
      return [];
    }

    if (data.status === "Error" || data.status === "Failed") {
      throw new Error(`Outscraper job failed with status: ${data.status}`);
    }

    // Still pending — keep polling
  }

  throw new Error("Outscraper job timed out after 2 minutes");
}

async function fetchReviewsFromOutscraper(placeId: string): Promise<OutscraperReview[]> {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) {
    throw new Error("OUTSCRAPER_API_KEY is not set");
  }

  const params = new URLSearchParams({
    query: placeId,
    reviewsLimit: "500",
    language: "en",
    sort: "newest",
    async: "true",  // explicitly request async mode
  });

  const res = await fetch(`${OUTSCRAPER_API_URL}?${params.toString()}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Outscraper API error ${res.status}: ${text}`);
  }

  const initial = await res.json() as any;
  logger.info({ placeId, status: initial.status, jobId: initial.id }, "Outscraper job submitted");

  // If already completed synchronously
  if (initial.status === "Success") {
    const raw = initial.data?.[0];
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray((raw as any).reviews)) return (raw as any).reviews;
    return [];
  }

  // Async — poll for results
  if (initial.results_location) {
    return pollForResults(initial.results_location, apiKey);
  }

  throw new Error(`Unexpected Outscraper response: ${JSON.stringify(initial).slice(0, 300)}`);
}

// ─── Sync Reviews for a Single Brand ─────────────────────────────────────────

export async function syncReviewsForBrand(brand: string): Promise<{
  brand: string;
  fetched: number;
  inserted: number;
  skipped: number;
}> {
  const [brandConfig] = await db
    .select()
    .from(brandConfigTable)
    .where(eq(brandConfigTable.brand, brand));

  if (!brandConfig) {
    throw new Error(`No brand config found for brand: ${brand}`);
  }

  if (!brandConfig.google_place_id) {
    logger.warn({ brand }, "Skipping reviews sync — no google_place_id configured");
    return { brand, fetched: 0, inserted: 0, skipped: 0 };
  }

  logger.info({ brand, placeId: brandConfig.google_place_id }, "Fetching reviews from Outscraper");

  const rawReviews = await fetchReviewsFromOutscraper(brandConfig.google_place_id);

  // Filter to 5-star only (Outscraper cutoff param should handle this, belt-and-suspenders)
  const fiveStarReviews = rawReviews.filter((r) => r.review_rating === FIVE_STAR_RATING);

  logger.info({ brand, fetched: rawReviews.length, fiveStar: fiveStarReviews.length }, "Reviews fetched");

  let inserted = 0;
  let skipped = 0;

  for (const review of fiveStarReviews) {
    try {
      await db
        .insert(reviewsTable)
        .values({
          brand,
          google_review_id: review.review_id,
          reviewer_name: review.author_title,
          reviewer_photo_url: review.author_image ?? null,
          rating: review.review_rating,
          comment: review.review_text ?? null,
          review_date: review.review_datetime_utc
            ? new Date(review.review_datetime_utc)
            : null,
          source: "google",
          is_published: true,
        })
        .onConflictDoNothing(); // skip if already stored (dedup by google_review_id)

      inserted++;
    } catch (err) {
      logger.warn({ err, reviewId: review.review_id, brand }, "Failed to insert review");
      skipped++;
    }
  }

  logger.info({ brand, inserted, skipped }, "Reviews sync complete");
  return { brand, fetched: fiveStarReviews.length, inserted, skipped };
}

// ─── Sync All Active Brands ───────────────────────────────────────────────────

export async function syncAllBrandReviews(): Promise<void> {
  logger.info("Reviews sync: starting for all brands with google_place_id");

  const brands = await db
    .select()
    .from(brandConfigTable)
    .where(sql`${brandConfigTable.google_place_id} IS NOT NULL`);

  if (brands.length === 0) {
    logger.info("Reviews sync: no brands with google_place_id configured, skipping");
    return;
  }

  const results = [];
  for (const brand of brands) {
    try {
      const result = await syncReviewsForBrand(brand.brand);
      results.push(result);
    } catch (err) {
      logger.error({ err, brand: brand.brand }, "Reviews sync: failed for brand");
    }
  }

  const total = results.reduce((sum, r) => sum + r.inserted, 0);
  logger.info({ results, totalInserted: total }, "Reviews sync: all brands complete");
}
