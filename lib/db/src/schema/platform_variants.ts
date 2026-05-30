import { pgTable, text, uuid, timestamp, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const platformVariantsTable = pgTable("platform_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: text("tenant_id").notNull(),

  variant_name: text("variant_name").notNull(),
  system_prompt: text("system_prompt").notNull(),
  greeting_message: text("greeting_message").notNull(),
  address_collection_method: text("address_collection_method").notNull().default("three_part"),
  closing_style: text("closing_style"),
  objection_handling: text("objection_handling"),

  status: text("status").notNull().default("active"),
  is_control: boolean("is_control").notNull().default(false),

  total_conversations: integer("total_conversations").notNull().default(0),
  successful_conversions: integer("successful_conversions").notNull().default(0),
  conversion_rate: doublePrecision("conversion_rate").notNull().default(0),

  test_start_date: timestamp("test_start_date", { withTimezone: true }),
  test_end_date: timestamp("test_end_date", { withTimezone: true }),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlatformVariantSchema = createInsertSchema(platformVariantsTable).omit({
  id: true, created_at: true, updated_at: true,
  total_conversations: true, successful_conversions: true, conversion_rate: true,
});
export type InsertPlatformVariant = z.infer<typeof insertPlatformVariantSchema>;
export type PlatformVariant = typeof platformVariantsTable.$inferSelect;
