import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const ledger = sqliteTable('ledger', {
  owner: text('owner').primaryKey(),
  revision: integer('revision').notNull(),
  payload: text('payload').notNull(),
  updated: text('updated').notNull(),
});

export const ledgerSnapshots = sqliteTable('ledger_snapshots', {
 owner: text('owner').notNull(), revision: integer('revision').notNull(), payload: text('payload').notNull(), updated: text('updated').notNull(),
}, table => [primaryKey({columns:[table.owner,table.revision]})]);
