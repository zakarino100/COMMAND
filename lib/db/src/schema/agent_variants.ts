import { pgTable, text, uuid, timestamp, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentVariantsTable = pgTable("agent_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_id: uuid("agent_id").notNull(),
  variant_name: text("variant_name").notNull(),
  
  // The actual behavior instructions
  system_prompt: text("system_prompt").notNull(),
  greeting_message: text("greeting_message").notNull(),
  address_validation_instructions: text("address_validation_instructions"),
  closing_instructions: text("closing_instructions"),
  objection_handling: text("objection_handling"),
  
  status: text("status").notNull().default("active"), // "active" | "testing" | "archived"
  is_control: boolean("is_control").notNull().default(false),
  
  // Performance metrics
  total_conversations: integer("total_conversations").notNull().default(0),
  successful_conversions: integer("successful_conversions").notNull().default(0),
  conversion_rate: doublePrecision("conversion_rate").notNull().default(0),
  
  test_start_date: timestamp("test_start_date", { withTimezone: true }),
  test_end_date: timestamp("test_end_date", { withTimezone: true }),
  
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentVariantSchema = createInsertSchema(agentVariantsTable).omit({ id: true, created_at: true, updated_at: true, total_conversations: true, successful_conversions: true, conversion_rate: true });
export type InsertAgentVariant = z.infer<typeof insertAgentVariantSchema>;
export type AgentVariant = typeof agentVariantsTable.$inferSelect;
