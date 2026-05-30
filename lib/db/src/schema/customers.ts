import { pgTable, text, uuid, timestamp, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand_id: uuid("brand_id").notNull(),
  
  // Contact info
  phone: text("phone"),
  email: text("email"),
  name: text("name"),
  
  // Address (for deduplication + service area check)
  street_number: text("street_number"),
  street_name: text("street_name"),
  city: text("city"),
  state: text("state"),
  zip_code: text("zip_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  
  // Service area
  in_service_area: boolean("in_service_area"),
  
  // Status
  status: text("status").notNull().default("new"), // "new" | "contacted" | "quoted" | "booked" | "customer"
  
  // Analytics
  visit_count: integer("visit_count").notNull().default(0),
  chat_count: integer("chat_count").notNull().default(0),
  quote_count: integer("quote_count").notNull().default(0),
  booking_count: integer("booking_count").notNull().default(0),
  
  last_interaction: timestamp("last_interaction", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
