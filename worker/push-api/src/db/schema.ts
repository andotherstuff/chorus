import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastSeen: timestamp('last_seen'),
}, (table) => {
  return {
    userEndpointIdx: index('user_endpoint_idx').on(table.userId, table.endpoint),
    userIdIdx: index('user_id_idx').on(table.userId),
  };
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
EOF 2>&1
