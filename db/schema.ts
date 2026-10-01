import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const ledger = sqliteTable('ledger', {
  owner: text('owner').primaryKey(),
  revision: integer('revision').notNull(),
  payload: text('payload').notNull(),
  updated: text('updated').notNull(),
});
