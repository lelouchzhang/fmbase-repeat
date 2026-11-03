import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import { randomBytes } from 'crypto';
import slugify from 'slugify';
import {
  organizationMembers,
  organizations,
} from '../db/schema/organizations.js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { projects } from '../db/schema/projects.js';
import { CreateOrganizationDto } from './dto/organization.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(private drizzleService: DrizzleService) {}

  private generateOrganizationSlug(name: string): string {
    const base = slugify(`${name}-org`, { lower: true, strict: true });
    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  async getMyOrganizations(userId: string) {
    return await this.drizzleService.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: organizationMembers.role,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        projectsCount: sql<number>`cast(count(distinct ${projects.id}) as int)`,
        membersCount: sql<number>`(
          select cast(count(*) as int)
          from organizations_members om
          where om.organization_id = ${organizations.id}
            and om.removed_at is null
        )`,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .leftJoin(projects, eq(projects.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, userId),
          isNull(organizationMembers.removedAt),
        ),
      )
      .groupBy(organizations.id, organizationMembers.role);
  }

  async getOrganizationBySlug(slug: string, userId: string) {
    const [row] = await this.drizzleService.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        role: organizationMembers.role,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, organizations.id),
          eq(organizationMembers.userId, userId),
          isNull(organizationMembers.removedAt),
        ),
      )
      .where(eq(organizations.slug, slug))
      .limit(1);
    return row;
  }

  async createOrganization(dto: CreateOrganizationDto, userId: string) {
    // todo: 事务？ findout db.transaction and implement other else
    return await this.drizzleService.db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: dto.name,
          slug: this.generateOrganizationSlug(dto.name),
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: organization.id,
        userId,
        role: 'admin',
      });
      return organization;
    });
  }
}
