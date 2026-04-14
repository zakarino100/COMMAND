import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// GET /embed/reviews/:brand
// Returns a self-contained JS snippet + CSS that renders the reviews widget
// Usage on any website: <script src="https://YOUR_REPLIT_URL/embed/reviews/showroomauto"></script>
//                       <div id="command-reviews"></div>
router.get("/embed/reviews/:brand", async (req, res) => {
  try {
    const { brand } = req.params;

    const reviews = await db
      .select({
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

    const total = reviews.length;

    const reviewsJson = JSON.stringify(reviews);

    const script = `
(function() {
  var reviews = ${reviewsJson};
  var total = ${total};
  var container = document.getElementById('command-reviews');
  if (!container) return;

  var stars = '<span style="color:#f5a623;font-size:18px;">★★★★★</span>';

  var header = '<div style="text-align:center;margin-bottom:24px;">' +
    '<div style="font-size:48px;font-weight:700;color:#111;">' + total + '</div>' +
    '<div style="font-size:16px;color:#555;">5-Star Google Reviews</div>' +
    '<div style="margin-top:6px;">' + stars + '</div>' +
    '</div>';

  var cards = reviews.map(function(r) {
    var photo = r.reviewer_photo_url
      ? '<img src="' + r.reviewer_photo_url + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-right:12px;" onerror="this.style.display=\'none\'">'
      : '<div style="width:48px;height:48px;border-radius:50%;background:#e0e0e0;margin-right:12px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#666;">' + (r.reviewer_name[0] || '?') + '</div>';

    var date = r.review_date ? new Date(r.review_date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '';

    return '<div style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">' +
      '<div style="display:flex;align-items:center;margin-bottom:12px;">' +
        photo +
        '<div>' +
          '<div style="font-weight:600;font-size:15px;color:#111;">' + r.reviewer_name + '</div>' +
          '<div style="font-size:12px;color:#999;">' + date + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:8px;">' + stars + '</div>' +
      '<div style="font-size:14px;color:#444;line-height:1.6;">' + (r.comment || '') + '</div>' +
    '</div>';
  }).join('');

  var grid = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;">' + cards + '</div>';

  container.innerHTML = header + grid;
})();
`.trim();

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=3600"); // cache 1 hour
    res.setHeader("Access-Control-Allow-Origin", "*"); // allow any website to embed
    res.send(script);
  } catch (err) {
    req.log.error({ err }, "Failed to generate embed script");
    res.status(500).send("// Error loading reviews");
  }
});

export default router;
