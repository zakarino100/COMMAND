import { Router } from "express";
import { db } from "@workspace/db";
import { adAccountsTable, adCampaignsTable, adMetricsDailyTable } from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function countActions(actions: any[] | undefined, keys: string[]) {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter((a) => keys.includes(String(a.action_type)))
    .reduce((sum, a) => sum + toNumber(a.value), 0);
}

function sumActionValues(values: any[] | undefined, keys: string[]) {
  if (!Array.isArray(values)) return 0;
  return values
    .filter((a) => keys.includes(String(a.action_type)))
    .reduce((sum, a) => sum + toNumber(a.value), 0);
}

function getMetaToken() {
  return (
    process.env.META_MARKETING_API_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    process.env.META_CONVERSIONS_ACCESS_TOKEN ||
    null
  );
}

router.get("/ads/accounts", async (req, res) => {
  try {
    const accounts = await db.select().from(adAccountsTable).orderBy(adAccountsTable.brand, adAccountsTable.platform, adAccountsTable.display_name);
    res.json({ accounts });
  } catch (err) {
    req.log.error({ err }, "Failed to list ad accounts");
    res.status(500).json({ error: "Failed to list ad accounts" });
  }
});

router.post("/ads/accounts/upsert", async (req, res) => {
  try {
    const { brand, platform, account_id, display_name, currency, timezone } = req.body as Record<string, string>;
    if (!brand || !platform || !account_id || !display_name) {
      return res.status(400).json({ error: "brand, platform, account_id, and display_name are required" });
    }

    const existing = await db.select().from(adAccountsTable)
      .where(and(eq(adAccountsTable.platform, platform), eq(adAccountsTable.account_id, account_id)));

    if (existing[0]) {
      await db.update(adAccountsTable)
        .set({ brand, display_name, currency: currency || null, timezone: timezone || null, is_active: true })
        .where(eq(adAccountsTable.id, existing[0].id));
    } else {
      await db.insert(adAccountsTable).values({
        brand,
        platform,
        account_id,
        display_name,
        currency: currency || null,
        timezone: timezone || null,
      });
    }

    const accounts = await db.select().from(adAccountsTable).orderBy(adAccountsTable.brand, adAccountsTable.platform, adAccountsTable.display_name);
    res.json({ ok: true, accounts });
  } catch (err) {
    req.log.error({ err }, "Failed to upsert ad account");
    res.status(500).json({ error: "Failed to upsert ad account" });
  }
});

router.get("/ads/summary", async (req, res) => {
  try {
    const { brand, platform, date_from, date_to } = req.query as Record<string, string>;
    const rows = await db.select().from(adMetricsDailyTable).orderBy(desc(adMetricsDailyTable.metric_date));

    let filtered = rows;
    if (brand && brand !== "all") filtered = filtered.filter((r) => r.brand === brand);
    if (platform && platform !== "all") filtered = filtered.filter((r) => r.platform === platform);
    if (date_from) filtered = filtered.filter((r) => new Date(r.metric_date) >= new Date(date_from));
    if (date_to) filtered = filtered.filter((r) => new Date(r.metric_date) <= new Date(date_to));

    const summary = filtered.reduce((acc, row) => {
      acc.spend += row.spend ?? 0;
      acc.impressions += row.impressions ?? 0;
      acc.clicks += row.clicks ?? 0;
      acc.leads += row.leads ?? 0;
      acc.conversions += row.conversions ?? 0;
      acc.revenue += row.revenue ?? 0;
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0 });

    const cpl = summary.leads > 0 ? summary.spend / summary.leads : 0;
    const ctr = summary.impressions > 0 ? summary.clicks / summary.impressions : 0;
    const cpc = summary.clicks > 0 ? summary.spend / summary.clicks : 0;
    const roas = summary.spend > 0 ? summary.revenue / summary.spend : 0;

    res.json({ ...summary, cpl, ctr, cpc, roas });
  } catch (err) {
    req.log.error({ err }, "Failed to get ads summary");
    res.status(500).json({ error: "Failed to get ads summary" });
  }
});

router.get("/ads/campaigns", async (req, res) => {
  try {
    const { brand, platform, date_from, date_to } = req.query as Record<string, string>;
    const campaigns = await db.select().from(adCampaignsTable).orderBy(desc(adCampaignsTable.updated_at));
    const metrics = await db.select().from(adMetricsDailyTable).orderBy(desc(adMetricsDailyTable.metric_date));

    let filteredCampaigns = campaigns;
    if (brand && brand !== "all") filteredCampaigns = filteredCampaigns.filter((r) => r.brand === brand);
    if (platform && platform !== "all") filteredCampaigns = filteredCampaigns.filter((r) => r.platform === platform);

    const rows = filteredCampaigns.map((campaign) => {
      let campaignMetrics = metrics.filter((m) => m.platform === campaign.platform && m.account_id === campaign.account_id && m.campaign_id === campaign.campaign_id);
      if (date_from) campaignMetrics = campaignMetrics.filter((r) => new Date(r.metric_date) >= new Date(date_from));
      if (date_to) campaignMetrics = campaignMetrics.filter((r) => new Date(r.metric_date) <= new Date(date_to));

      const totals = campaignMetrics.reduce((acc, row) => {
        acc.spend += row.spend ?? 0;
        acc.impressions += row.impressions ?? 0;
        acc.clicks += row.clicks ?? 0;
        acc.leads += row.leads ?? 0;
        acc.conversions += row.conversions ?? 0;
        acc.revenue += row.revenue ?? 0;
        return acc;
      }, { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0 });

      return {
        ...campaign,
        ...totals,
        cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
      };
    }).sort((a, b) => b.spend - a.spend);

    res.json({ campaigns: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to get ad campaigns");
    res.status(500).json({ error: "Failed to get ad campaigns" });
  }
});

router.get("/ads/insights", async (req, res) => {
  try {
    const { brand, platform, date_from, date_to } = req.query as Record<string, string>;
    let campaigns = await db.select().from(adCampaignsTable).orderBy(desc(adCampaignsTable.updated_at));
    let metrics = await db.select().from(adMetricsDailyTable).orderBy(desc(adMetricsDailyTable.metric_date));

    if (brand && brand !== "all") {
      campaigns = campaigns.filter((r) => r.brand === brand);
      metrics = metrics.filter((r) => r.brand === brand);
    }
    if (platform && platform !== "all") {
      campaigns = campaigns.filter((r) => r.platform === platform);
      metrics = metrics.filter((r) => r.platform === platform);
    }
    if (date_from) metrics = metrics.filter((r) => new Date(r.metric_date) >= new Date(date_from));
    if (date_to) metrics = metrics.filter((r) => new Date(r.metric_date) <= new Date(date_to));

    const insights: string[] = [];

    const ranked = campaigns.map((c) => {
      const rows = metrics.filter((m) => m.platform === c.platform && m.account_id === c.account_id && m.campaign_id === c.campaign_id);
      const spend = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
      const leads = rows.reduce((s, r) => s + (r.leads ?? 0), 0);
      const revenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
      return {
        name: c.campaign_name,
        brand: c.brand,
        platform: c.platform,
        spend,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
        roas: spend > 0 ? revenue / spend : 0,
      };
    }).filter((r) => r.spend > 0);

    const bestRoas = [...ranked].sort((a, b) => b.roas - a.roas)[0];
    if (bestRoas) insights.push(`${bestRoas.name} is your strongest campaign right now with ${bestRoas.roas.toFixed(2)}x ROAS.`);

    const cheapestLead = ranked.filter((r) => r.leads > 0).sort((a, b) => a.cpl - b.cpl)[0];
    if (cheapestLead) insights.push(`${cheapestLead.name} has the cheapest leads at $${cheapestLead.cpl.toFixed(2)} CPL.`);

    const waste = ranked.filter((r) => r.spend > 25 && r.leads === 0).sort((a, b) => b.spend - a.spend)[0];
    if (waste) insights.push(`${waste.name} has spent $${waste.spend.toFixed(2)} with zero leads — likely needs a cut or rewrite.`);

    if (insights.length === 0) insights.push("Connect an ad account and run your first sync to see performance insights.");

    res.json({ insights: insights.slice(0, 4) });
  } catch (err) {
    req.log.error({ err }, "Failed to get ad insights");
    res.status(500).json({ error: "Failed to get ad insights" });
  }
});

router.post("/ads/sync/meta", async (req, res) => {
  try {
    const token = getMetaToken();
    if (!token) return res.status(500).json({ error: "META_MARKETING_API_TOKEN (or fallback Meta token) is not set" });

    const body = (req.body ?? {}) as Record<string, string>;
    let accounts = await db.select().from(adAccountsTable).where(eq(adAccountsTable.platform, "meta"));

    if (body.account_id) {
      accounts = accounts.filter((a) => a.account_id === body.account_id);
    }
    if (body.brand) {
      accounts = accounts.filter((a) => a.brand === body.brand);
    }
    if (accounts.length === 0) {
      return res.status(400).json({ error: "No Meta ad accounts configured. Add one first on the Ads page." });
    }

    const synced: any[] = [];

    for (const account of accounts) {
      const actId = account.account_id.startsWith("act_") ? account.account_id : `act_${account.account_id}`;

      const campaignsRes = await fetch(
        `https://graph.facebook.com/v20.0/${actId}/campaigns?fields=id,name,status,objective&limit=200&access_token=${encodeURIComponent(token)}`
      );
      const campaignsData = await campaignsRes.json() as any;
      if (!campaignsRes.ok || campaignsData.error) {
        req.log.error({ campaignsData, account: account.account_id }, "Meta campaigns fetch failed");
        continue;
      }

      const insightsRes = await fetch(
        `https://graph.facebook.com/v20.0/${actId}/insights?level=campaign&time_increment=1&date_preset=last_30d&fields=campaign_id,campaign_name,date_start,spend,impressions,clicks,cpc,cpm,ctr,actions,action_values&limit=500&access_token=${encodeURIComponent(token)}`
      );
      const insightsData = await insightsRes.json() as any;
      if (!insightsRes.ok || insightsData.error) {
        req.log.error({ insightsData, account: account.account_id }, "Meta insights fetch failed");
        continue;
      }

      const campaigns = Array.isArray(campaignsData.data) ? campaignsData.data : [];
      const insights = Array.isArray(insightsData.data) ? insightsData.data : [];

      // Refresh account's metrics rows before re-inserting last 30d snapshot
      await db.delete(adMetricsDailyTable).where(and(eq(adMetricsDailyTable.platform, "meta"), eq(adMetricsDailyTable.account_id, account.account_id)));

      for (const c of campaigns) {
        const existing = await db.select().from(adCampaignsTable)
          .where(and(eq(adCampaignsTable.platform, "meta"), eq(adCampaignsTable.account_id, account.account_id), eq(adCampaignsTable.campaign_id, String(c.id))));

        if (existing[0]) {
          await db.update(adCampaignsTable)
            .set({
              brand: account.brand,
              campaign_name: c.name,
              status: c.status ?? null,
              objective: c.objective ?? null,
              updated_at: new Date(),
              last_synced_at: new Date(),
            })
            .where(eq(adCampaignsTable.id, existing[0].id));
        } else {
          await db.insert(adCampaignsTable).values({
            brand: account.brand,
            platform: "meta",
            account_id: account.account_id,
            campaign_id: String(c.id),
            campaign_name: c.name,
            status: c.status ?? null,
            objective: c.objective ?? null,
            last_synced_at: new Date(),
          });
        }
      }

      for (const row of insights) {
        const leads = countActions(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
        const conversions = countActions(row.actions, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
        const revenue = sumActionValues(row.action_values, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
        const spend = toNumber(row.spend);

        await db.insert(adMetricsDailyTable).values({
          brand: account.brand,
          platform: "meta",
          account_id: account.account_id,
          campaign_id: String(row.campaign_id),
          metric_date: row.date_start,
          spend,
          impressions: Math.round(toNumber(row.impressions)),
          clicks: Math.round(toNumber(row.clicks)),
          cpc: toNumber(row.cpc),
          cpm: toNumber(row.cpm),
          ctr: toNumber(row.ctr) / 100,
          leads,
          conversions,
          revenue,
          roas: spend > 0 ? revenue / spend : 0,
          raw_payload: JSON.stringify(row),
        });
      }

      synced.push({ account_id: account.account_id, brand: account.brand, campaigns: campaigns.length, daily_rows: insights.length });
    }

    res.json({ ok: true, synced });
  } catch (err) {
    req.log.error({ err }, "Failed to sync Meta ads");
    res.status(500).json({ error: "Failed to sync Meta ads" });
  }
});

router.post("/ads/sync/google", async (req, res) => {
  res.status(501).json({
    error: "Google Ads sync is scaffolded next. Need GOOGLE_ADS_DEVELOPER_TOKEN + OAuth credentials wired into COMMAND first.",
  });
});

export default router;
