import { Router } from "express";
import { db } from "@workspace/db";
import { brandConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey: key });
}

router.post("/ai/generate-caption", async (req, res) => {
  try {
    const { brand, content_type, brief } = req.body;

    if (!brand || !content_type || !brief) {
      return res.status(400).json({ error: "Missing required fields: brand, content_type, brief" });
    }

    const [brandConfig] = await db.select().from(brandConfigTable).where(eq(brandConfigTable.brand, brand));
    const brandVoice = brandConfig?.brand_voice ?? "Friendly, professional, conversion-focused.";
    const displayName = brandConfig?.display_name ?? brand;

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You write punchy, human, conversion-focused social media captions for home service businesses. No hashtag spam. No corporate tone. Short sentences. Strong hooks. Write for the brand voice provided. Return only the caption text, nothing else.",
        },
        {
          role: "user",
          content: `Brand: ${displayName}. Voice: ${brandVoice}. Content type: ${content_type.replace(/_/g, " ")}. Brief: ${brief}.\nWrite a caption.`,
        },
      ],
      max_tokens: 500,
    });

    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ caption });
  } catch (err: any) {
    req.log.error({ err }, "Failed to generate caption");
    res.status(500).json({ error: err.message ?? "AI caption generation failed" });
  }
});

export default router;
