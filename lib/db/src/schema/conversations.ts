import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_id: uuid("agent_id").notNull(),
  brand_id: uuid("brand_id").notNull(),
  customer_id: uuid("customer_id"), // May be null for new leads
  
  channel: text("channel").notNull(), // "sms" | "web_chat" | "discord" | "phone"
  variant_id: uuid("variant_id"), // Which variant is being tested?
  
  messages: jsonb("messages").notNull().default([]), // [{ role: "user"|"assistant", content, timestamp }]
  
  // Outcome
  outcome: text("outcome"), // "quote_requested" | "booking_made" | "abandoned" | "handed_off_to_human"
  
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ended_at: timestamp("ended_at", { withTimezone: true }),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
