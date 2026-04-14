import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: text("brand").notNull(),
  google_review_id: text("google_review_id").notNull().unique(),
  reviewer_name: text("reviewer_name").notNull(),
  reviewer_photo_url: text("reviewer_photo_url"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  review_date: timestamp("review_date", { withTimezone: true }),
  source: text("source").notNull().default("google"),
  is_published: boolean("is_published").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
