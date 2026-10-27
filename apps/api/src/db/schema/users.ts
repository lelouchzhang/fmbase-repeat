import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text('email').notNull(),
    provider: text('provider').notNull().default('email'),
    providerUserId: text('provider_user_id'),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('users_provider_provider_user_id_unique').on(
      t.provider,
      t.providerUserId,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
