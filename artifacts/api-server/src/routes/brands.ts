import { Router } from "express";
import { db } from "@workspace/db";
import { brandConfigTable } from "@workspace/db/schema";

const router = Router();

router.get("/brands", async (req, res) => {
  try {
    const brands = await db.select().from(brandConfigTable).orderBy(brandConfigTable.display_name);
    res.json({ brands });
  } catch (err) {
    req.log.error({ err }, "Failed to list brands");
    res.status(500).json({ error: "Failed to list brands" });
  }
});

export default router;
