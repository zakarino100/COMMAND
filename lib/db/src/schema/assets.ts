import { pgTable, text, uuid, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assetsTable = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: text("brand").notNull(),
  url: text("url").notNull(),
  format: text("format").notNull(),
  content_type: text("content_type").notNull(),
  times_used: integer("times_used").notNull().default(0),
  avg_engagement: real("avg_engagement"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, created_at: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
