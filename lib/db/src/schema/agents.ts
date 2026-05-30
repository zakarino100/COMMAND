import { pgTable, text, uuid, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentsTable = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  brand_id: uuid("brand_id").notNull(),
  
  mode: text("mode").notNull(), // "assistant" | "sales_rep"
  status: text("status").notNull().default("active"), // "active" | "paused" | "testing" | "archived"
  
  avatar_url: text("avatar_url"),
  channels: jsonb("channels").notNull().default({}), // { sms: true, web_chat: true, etc }
  
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
