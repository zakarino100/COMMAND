import { pgTable, text, uuid, timestamp, real, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adMetricsDailyTable = pgTable("ad_metrics_daily", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: text("brand").notNull(),
  platform: text("platform").notNull(), // meta | google
  account_id: text("account_id").notNull(),
  campaign_id: text("campaign_id").notNull(),
  metric_date: date("metric_date").notNull(),
  spend: real("spend").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  cpc: real("cpc").notNull().default(0),
  cpm: real("cpm").notNull().default(0),
  ctr: real("ctr").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  revenue: real("revenue").notNull().default(0),
  roas: real("roas").notNull().default(0),
  raw_payload: text("raw_payload"),
  synced_at: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdMetricDailySchema = createInsertSchema(adMetricsDailyTable).omit({
  id: true,
  created_at: true,
  synced_at: true,
});
export type InsertAdMetricDaily = z.infer<typeof insertAdMetricDailySchema>;
export type AdMetricDaily = typeof adMetricsDailyTable.$inferSelect;
