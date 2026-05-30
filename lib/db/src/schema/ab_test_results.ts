import { pgTable, text, uuid, timestamp, date, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const abTestResultsTable = pgTable("ab_test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_id: uuid("agent_id").notNull(),
  
  control_variant_id: uuid("control_variant_id"),
  challenger_variant_id: uuid("challenger_variant_id"),
  
  // Metrics
  control_conversations: integer("control_conversations").notNull().default(0),
  control_conversions: integer("control_conversions").notNull().default(0),
  control_conversion_rate: doublePrecision("control_conversion_rate").notNull().default(0),
  
  challenger_conversations: integer("challenger_conversations").notNull().default(0),
  challenger_conversions: integer("challenger_conversions").notNull().default(0),
  challenger_conversion_rate: doublePrecision("challenger_conversion_rate").notNull().default(0),
  
  // Statistics
  uplift_percentage: doublePrecision("uplift_percentage"),
  statistical_significance: doublePrecision("statistical_significance"), // p-value
  winner_variant_id: uuid("winner_variant_id"), // Who won?
  confidence_level: text("confidence_level"), // "95%" | "99%" | "inconclusive"
  
  test_start_date: date("test_start_date").notNull(),
  test_end_date: date("test_end_date"),
  
  notes: text("notes"),
  
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAbTestResultSchema = createInsertSchema(abTestResultsTable).omit({ id: true, created_at: true });
export type InsertAbTestResult = z.infer<typeof insertAbTestResultSchema>;
export type AbTestResult = typeof abTestResultsTable.$inferSelect;
