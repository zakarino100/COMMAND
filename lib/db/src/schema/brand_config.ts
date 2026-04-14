import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brandConfigTable = pgTable("brand_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: text("brand").notNull().unique(),
  display_name: text("display_name").notNull(),
  emoji: text("emoji").notNull(),
  fb_page_id: text("fb_page_id"),
  ig_account_id: text("ig_account_id"),
  gbp_location_id: text("gbp_location_id"),
  google_place_id: text("google_place_id"),
  brand_voice: text("brand_voice").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrandConfigSchema = createInsertSchema(brandConfigTable).omit({ id: true, created_at: true });
export type InsertBrandConfig = z.infer<typeof insertBrandConfigSchema>;
export type BrandConfig = typeof brandConfigTable.$inferSelect;
