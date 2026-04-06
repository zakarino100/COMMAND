import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adCampaignsTable = pgTable("ad_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: text("brand").notNull(),
  platform: text("platform").notNull(), // meta | google
  account_id: text("account_id").notNull(),
  campaign_id: text("campaign_id").notNull(),
  campaign_name: text("campaign_name").notNull(),
  status: text("status"),
  objective: text("objective"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  last_synced_at: timestamp("last_synced_at", { withTimezone: true }),
});

export const insertAdCampaignSchema = createInsertSchema(adCampaignsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;
export type AdCampaign = typeof adCampaignsTable.$inferSelect;
