import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────
const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = process.env.COMMAND_API_KEY;
  if (!apiKey) { next(); return; } // no key set → open (dev only)
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ") || header.slice(7) !== apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

router.use("/agents", requireApiKey);
router.use("/customers", requireApiKey);
router.use("/variants", requireApiKey);
router.use("/conversations", requireApiKey);

// ─── Agents (backed by swell_ai_configs + swell_tenants) ─────────────────────

// GET /api/agents — list all tenants + their AI config
router.get("/agents", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT ac.*, t.name AS tenant_name, t.slug, t.enabled,
             t.owner_name, t.owner_phone, t.owner_discord_user_id
      FROM swell_ai_configs ac
      JOIN swell_tenants t ON t.id = ac.tenant_id
      ORDER BY t.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /agents error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/agents/:tenant_id — single agent with active variant
router.get("/agents/:tenant_id", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.params;
    const result = await db.execute(sql`
      SELECT ac.*, t.name AS tenant_name, t.slug, t.enabled,
             t.owner_name, t.owner_phone, t.owner_discord_user_id,
             t.owner_discord_channel_id, t.google_review_url
      FROM swell_ai_configs ac
      JOIN swell_tenants t ON t.id = ac.tenant_id
      WHERE ac.tenant_id = ${tenant_id}
      LIMIT 1
    `);
    if (!result.rows.length) { res.status(404).json({ error: "Agent not found" }); return; }

    const variant = await db.execute(sql`
      SELECT * FROM platform_variants
      WHERE tenant_id = ${tenant_id} AND is_control = true
      LIMIT 1
    `);
    res.json({ ...result.rows[0], active_variant: variant.rows[0] ?? null });
  } catch (err) {
    console.error("GET /agents/:id error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/agents/:tenant_id — update agent config
router.patch("/agents/:tenant_id", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.params;
    const { avatar_url, channels, mode, persona_name, services_json, pricing_matrix, custom_brand_notes } = req.body;
    await db.execute(sql`
      UPDATE swell_ai_configs SET
        avatar_url         = COALESCE(${avatar_url ?? null}, avatar_url),
        channels           = COALESCE(${channels ? JSON.stringify(channels) : null}::jsonb, channels),
        mode               = COALESCE(${mode ?? null}, mode),
        persona_name       = COALESCE(${persona_name ?? null}, persona_name),
        services_json      = COALESCE(${services_json ? JSON.stringify(services_json) : null}::jsonb, services_json),
        pricing_matrix     = COALESCE(${pricing_matrix ? JSON.stringify(pricing_matrix) : null}::jsonb, pricing_matrix),
        custom_brand_notes = COALESCE(${custom_brand_notes ?? null}, custom_brand_notes),
        updated_at         = NOW()
      WHERE tenant_id = ${tenant_id}
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /agents/:id error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Variants (platform_variants — system-prompt A/B testing) ─────────────────

// GET /api/agents/:tenant_id/variants
router.get("/agents/:tenant_id/variants", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.params;
    const result = await db.execute(sql`
      SELECT *,
        CASE WHEN total_conversations > 0
          THEN ROUND((successful_conversions::numeric / total_conversations) * 100, 2)
          ELSE 0 END AS conversion_pct
      FROM platform_variants
      WHERE tenant_id = ${tenant_id}
      ORDER BY is_control DESC, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET variants error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/agents/:tenant_id/variants
router.post("/agents/:tenant_id/variants", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.params;
    const { variant_name, system_prompt, greeting_message, address_collection_method, closing_style, objection_handling, is_control } = req.body;
    if (!variant_name || !system_prompt || !greeting_message) {
      res.status(400).json({ error: "variant_name, system_prompt, greeting_message required" });
      return;
    }
    // Unset existing controls if this is the new control
    if (is_control) {
      await db.execute(sql`UPDATE platform_variants SET is_control = false WHERE tenant_id = ${tenant_id}`);
    }
    const result = await db.execute(sql`
      INSERT INTO platform_variants
        (tenant_id, variant_name, system_prompt, greeting_message,
         address_collection_method, closing_style, objection_handling, is_control)
      VALUES
        (${tenant_id}, ${variant_name}, ${system_prompt}, ${greeting_message},
         ${address_collection_method ?? "three_part"}, ${closing_style ?? null},
         ${objection_handling ?? null}, ${is_control ?? false})
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST variants error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/variants/:variant_id/stats — called after each conversation ends
router.patch("/variants/:variant_id/stats", async (req: Request, res: Response) => {
  try {
    const { variant_id } = req.params;
    const { converted } = req.body;
    await db.execute(sql`
      UPDATE platform_variants SET
        total_conversations    = total_conversations + 1,
        successful_conversions = successful_conversions + ${converted ? 1 : 0},
        conversion_rate        = (successful_conversions + ${converted ? 1 : 0})::float
                                 / (total_conversations + 1),
        updated_at             = NOW()
      WHERE id = ${variant_id}::uuid
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH variant stats error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Conversations (backed by swell_conversations + swell_conversation_messages) ─

// POST /api/conversations/message — log a single turn
router.post("/conversations/message", async (req: Request, res: Response) => {
  try {
    const { conversation_id, tenant_id, role, body, model_used, tokens_in, tokens_out, platform_variant_id } = req.body;
    if (!conversation_id || !tenant_id || !role || !body) {
      res.status(400).json({ error: "conversation_id, tenant_id, role, body required" });
      return;
    }
    const msg = await db.execute(sql`
      INSERT INTO swell_conversation_messages (conversation_id, tenant_id, role, body, model_used, tokens_in, tokens_out)
      VALUES (${conversation_id}, ${tenant_id}, ${role}, ${body},
              ${model_used ?? null}, ${tokens_in ?? null}, ${tokens_out ?? null})
      RETURNING *
    `);
    await db.execute(sql`
      UPDATE swell_conversations SET
        last_message_at     = NOW(),
        last_role           = ${role},
        total_messages      = total_messages + 1,
        platform_variant_id = COALESCE(${platform_variant_id ?? null}::uuid, platform_variant_id),
        updated_at          = NOW()
      WHERE id = ${conversation_id}
    `);
    res.status(201).json(msg.rows[0]);
  } catch (err) {
    console.error("POST /conversations/message error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/conversations/:id/messages
router.get("/conversations/:conversation_id/messages", async (req: Request, res: Response) => {
  try {
    const { conversation_id } = req.params;
    const result = await db.execute(sql`
      SELECT * FROM swell_conversation_messages
      WHERE conversation_id = ${conversation_id}
      ORDER BY created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET messages error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Customers (backed by swell_customers) ────────────────────────────────────

// GET /api/customers/search?tenant_id=&phone=&address=
router.get("/customers/search", async (req: Request, res: Response) => {
  try {
    const { tenant_id, phone, address } = req.query as Record<string, string>;
    if (!tenant_id || (!phone && !address)) {
      res.status(400).json({ error: "tenant_id + (phone or address) required" });
      return;
    }
    let rows;
    if (phone) {
      rows = await db.execute(sql`
        SELECT * FROM swell_customers WHERE tenant_id = ${tenant_id} AND phone = ${phone} LIMIT 5
      `);
    }
    if ((!rows || !rows.rows.length) && address) {
      rows = await db.execute(sql`
        SELECT * FROM swell_customers
        WHERE tenant_id = ${tenant_id} AND address ILIKE ${"%" + address + "%"}
        LIMIT 5
      `);
    }
    if (!rows || !rows.rows.length) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(rows.rows);
  } catch (err) {
    console.error("GET customers/search error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/customers — create or update (dedup by phone OR address)
router.post("/customers", async (req: Request, res: Response) => {
  try {
    const { tenant_id, phone, full_name, email, address, city, state, zip, source } = req.body;
    if (!tenant_id) { res.status(400).json({ error: "tenant_id required" }); return; }

    let existing: any = null;
    if (phone) {
      const r = await db.execute(sql`SELECT * FROM swell_customers WHERE tenant_id=${tenant_id} AND phone=${phone} LIMIT 1`);
      existing = r.rows[0];
    }
    if (!existing && address && city) {
      const r = await db.execute(sql`SELECT * FROM swell_customers WHERE tenant_id=${tenant_id} AND address ILIKE ${"%" + address + "%"} AND city ILIKE ${city} LIMIT 1`);
      existing = r.rows[0];
    }

    if (existing) {
      const updated = await db.execute(sql`
        UPDATE swell_customers SET
          full_name  = COALESCE(${full_name ?? null}, full_name),
          email      = COALESCE(${email ?? null}, email),
          phone      = COALESCE(${phone ?? null}, phone),
          address    = COALESCE(${address ?? null}, address),
          city       = COALESCE(${city ?? null}, city),
          state      = COALESCE(${state ?? null}, state),
          zip        = COALESCE(${zip ?? null}, zip),
          updated_at = NOW()
        WHERE id = ${existing.id} RETURNING *
      `);
      res.json({ customer: updated.rows[0], created: false });
      return;
    }

    const created = await db.execute(sql`
      INSERT INTO swell_customers (tenant_id, phone, full_name, email, address, city, state, zip, source)
      VALUES (${tenant_id}, ${phone ?? null}, ${full_name ?? null}, ${email ?? null},
              ${address ?? null}, ${city ?? null}, ${state ?? null}, ${zip ?? null},
              ${source ?? "web_chat"})
      RETURNING *
    `);
    res.status(201).json({ customer: created.rows[0], created: true });
  } catch (err) {
    console.error("POST /customers error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── A/B Tests ────────────────────────────────────────────────────────────────

// GET /api/agents/:tenant_id/ab-tests — message-level A/B history (swell_ab_test_history)
router.get("/agents/:tenant_id/ab-tests", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.params;
    const result = await db.execute(sql`
      SELECT * FROM swell_ab_test_history
      WHERE tenant_id = ${tenant_id}
      ORDER BY created_at DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET ab-tests error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
