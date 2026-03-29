import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db/schema";
import { createClient } from "@supabase/supabase-js";
import { eq, desc } from "drizzle-orm";

const router = Router();

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key);
}

router.get("/assets", async (req, res) => {
  try {
    const { brand, content_type, format } = req.query as Record<string, string>;

    let assets = await db.select().from(assetsTable).orderBy(desc(assetsTable.created_at));

    if (brand) assets = assets.filter(a => a.brand === brand);
    if (content_type) assets = assets.filter(a => a.content_type === content_type);
    if (format) assets = assets.filter(a => a.format === format);

    res.json({ assets });
  } catch (err) {
    req.log.error({ err }, "Failed to list assets");
    res.status(500).json({ error: "Failed to list assets" });
  }
});

router.post("/assets/upload-url", async (req, res) => {
  try {
    const { filename, contentType, brand, assetContentType, format } = req.body;

    if (!filename || !contentType || !brand || !assetContentType || !format) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const supabase = getSupabase();
    const path = `${brand}/${Date.now()}-${filename}`;

    const { data, error } = await supabase.storage
      .from("post-images")
      .createSignedUploadUrl(path);

    if (error) {
      req.log.error({ error }, "Failed to create signed upload URL");
      return res.status(500).json({ error: "Failed to create upload URL" });
    }

    const { data: publicData } = supabase.storage
      .from("post-images")
      .getPublicUrl(path);

    const [asset] = await db.insert(assetsTable).values({
      brand,
      url: publicData.publicUrl,
      format,
      content_type: assetContentType,
      times_used: 0,
    }).returning();

    res.json({
      uploadUrl: data.signedUrl,
      publicUrl: publicData.publicUrl,
      assetId: asset.id,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get upload URL");
    res.status(500).json({ error: "Failed to get upload URL" });
  }
});

export default router;
