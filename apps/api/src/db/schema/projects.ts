import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const projects = pgTable('projects', {
  id: uuid().primaryKey().defaultRandom(),
  organizationsId: uuid()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  databaseSchema: text('database_schema').notNull().unique(),
  projectUrl: text('project_url').notNull().unique(),
  anonymousApiKey: text('anonymous_api_key').notNull(),
  serviceRoleKey: text('service_role_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
