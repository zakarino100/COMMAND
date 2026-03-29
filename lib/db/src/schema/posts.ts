import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: text("brand").notNull(),
  platforms: text("platforms").array().notNull(),
  caption: text("caption").notNull(),
  image_url: text("image_url"),
  video_url: text("video_url"),
  media_format: text("media_format").notNull().default("text"),
  link_url: text("link_url"),
  link_url_tagged: text("link_url_tagged"),
  content_type: text("content_type").notNull(),
  headline_variant: text("headline_variant"),
  scheduled_at: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  posted_at: timestamp("posted_at", { withTimezone: true }),
  error_message: text("error_message"),
  fb_post_id: text("fb_post_id"),
  ig_post_id: text("ig_post_id"),
  gbp_post_id: text("gbp_post_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, created_at: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
