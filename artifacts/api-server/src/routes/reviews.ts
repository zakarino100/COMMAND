import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { syncReviewsForBrand } from "../lib/reviews.js";

const router = Router();

// GET /reviews/:brand/all
// Returns ALL reviews for a brand regardless of rating (used by CRM/internal)
router.get("/reviews/:brand/all", async (req, res) => {
  try {
    const { brand } = req.params;
    const minRating = req.query.minRating ? parseInt(req.query.minRating as string, 10) : 1;

    const reviews = await db
      .select({
        id: reviewsTable.id,
        reviewer_name: reviewsTable.reviewer_name,
        reviewer_photo_url: reviewsTable.reviewer_photo_url,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        review_date: reviewsTable.review_date,
        is_published: reviewsTable.is_published,
        source: reviewsTable.source,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.brand, brand),
          gte(reviewsTable.rating, minRating)
        )
      )
      .orderBy(desc(reviewsTable.review_date));

    res.json({
      brand,
      total: reviews.length,
      fiveStar: reviews.filter(r => r.rating === 5).length,
      reviews,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch all reviews");
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// GET /reviews/:brand
// Returns all published 5-star reviews for a brand (used by website embeds)
router.get("/reviews/:brand", async (req, res) => {
  try {
    const { brand } = req.params;

    const reviews = await db
      .select({
        id: reviewsTable.id,
        reviewer_name: reviewsTable.reviewer_name,
        reviewer_photo_url: reviewsTable.reviewer_photo_url,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        review_date: reviewsTable.review_date,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.brand, brand),
          eq(reviewsTable.rating, 5),
          eq(reviewsTable.is_published, true)
        )
      )
      .orderBy(desc(reviewsTable.review_date));

    res.json({
      brand,
      total: reviews.length,
      reviews,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch reviews");
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// POST /reviews/:brand/sync
// Manually trigger a review sync for a single brand (admin use)
router.post("/reviews/:brand/sync", async (req, res) => {
  try {
    const { brand } = req.params;
    const result = await syncReviewsForBrand(brand);
    res.json({ success: true, ...result });
  } catch (err: any) {
    req.log.error({ err }, "Failed to sync reviews");
    res.status(500).json({ error: err.message ?? "Failed to sync reviews" });
  }
});

// PATCH /reviews/:id/publish
// Toggle a review's published status (hide/show from website)
router.patch("/reviews/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_published } = req.body as { is_published: boolean };

    if (typeof is_published !== "boolean") {
      res.status(400).json({ error: "is_published must be a boolean" });
      return;
    }

    await db
      .update(reviewsTable)
      .set({ is_published, updated_at: new Date() })
      .where(eq(reviewsTable.id, id));

    res.json({ success: true, id, is_published });
  } catch (err) {
    req.log.error({ err }, "Failed to update review");
    res.status(500).json({ error: "Failed to update review" });
  }
});

export default router;
