import { pgTable, text, uuid, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postMetricsTable = pgTable("post_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  post_id: uuid("post_id").notNull(),
  platform: text("platform").notNull(),
  fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull(),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  engagement_rate: real("engagement_rate").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostMetricSchema = createInsertSchema(postMetricsTable).omit({ id: true, created_at: true });
export type InsertPostMetric = z.infer<typeof insertPostMetricSchema>;
export type PostMetric = typeof postMetricsTable.$inferSelect;
