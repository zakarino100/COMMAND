import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db/schema";
import { createClient } from "@supabase/supabase-js";
import { desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();
const BUCKET = "media";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key);
}

export async function initStorage(): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      logger.warn({ error }, "Storage: failed to list buckets");
      return;
    }
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (createErr) {
        logger.warn({ createErr }, `Storage: failed to create bucket '${BUCKET}'`);
      } else {
        logger.info(`Storage: created bucket '${BUCKET}' with public access`);
      }
    } else {
      logger.info(`Storage: bucket '${BUCKET}' already exists`);
    }
  } catch (err) {
    logger.warn({ err }, "Storage: initStorage error");
  }
}

router.get("/assets", async (req, res) => {
  try {
    const { brand, content_type, format } = req.query as Record<string, string>;
    let assets = await db.select().from(assetsTable).orderBy(desc(assetsTable.created_at));
    if (brand) assets = assets.filter((a) => a.brand === brand);
    if (content_type) assets = assets.filter((a) => a.content_type === content_type);
    if (format) assets = assets.filter((a) => a.format === format);
    res.json({ assets });
  } catch (err) {
    req.log.error({ err }, "Failed to list assets");
    res.status(500).json({ error: "Failed to list assets" });
  }
});

// Direct server-side upload — file goes through our API → Supabase Storage
router.post("/assets/upload", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const { brand, assetContentType, format } = req.body as Record<string, string>;

    if (!file) return res.status(400).json({ error: "No file provided" });
    if (!brand || !assetContentType || !format) {
      return res.status(400).json({ error: "Missing required fields: brand, assetContentType, format" });
    }

    const ext = file.originalname.split(".").pop() ?? "bin";
    const storagePath = `${brand}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      req.log.error({ uploadError }, "Supabase Storage upload failed");
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicData.publicUrl;

    const [asset] = await db
      .insert(assetsTable)
      .values({ brand, url: publicUrl, format, content_type: assetContentType, times_used: 0 })
      .returning();

    req.log.info({ assetId: asset.id, publicUrl, brand, format }, "Asset uploaded to Supabase Storage");
    res.json({ publicUrl, assetId: asset.id });
  } catch (err) {
    req.log.error({ err }, "Failed to upload asset");
    res.status(500).json({ error: "Failed to upload asset" });
  }
});

// Keep old signed-URL endpoint so existing code doesn't 404, but mark as deprecated
router.post("/assets/upload-url", async (req, res) => {
  res.status(410).json({ error: "This endpoint is deprecated. Use POST /api/assets/upload (multipart/form-data) instead." });
});

export default router;
