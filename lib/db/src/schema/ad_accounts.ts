import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adAccountsTable = pgTable("ad_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: text("brand").notNull(),
  platform: text("platform").notNull(), // meta | google
  account_id: text("account_id").notNull(),
  display_name: text("display_name").notNull(),
  currency: text("currency"),
  timezone: text("timezone"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdAccountSchema = createInsertSchema(adAccountsTable).omit({
  id: true,
  created_at: true,
});
export type InsertAdAccount = z.infer<typeof insertAdAccountSchema>;
export type AdAccount = typeof adAccountsTable.$inferSelect;
