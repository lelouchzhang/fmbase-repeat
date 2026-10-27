import { timestamp, uuid, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const OrganizationEnum = pgEnum('organizationUserRole', [
  'admin',
  'developer',
]);

export const organizations = pgTable('organizations', {
  id: uuid().primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizationMembers = pgTable('organizations_members', {
  id: uuid().primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: OrganizationEnum('role').notNull().default('developer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  removedAt: timestamp('removed_at'),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
