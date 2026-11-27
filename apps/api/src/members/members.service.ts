import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import {
  organizationMembers,
  organizations,
} from '../db/schema/organizations.js';
import { and, eq, isNull } from 'drizzle-orm';
import { users } from '../db/schema/users.js';
import { UpdateRoleInOrganizationDto } from './dto/member.dto.js';

@Injectable()
export class MembersService {
  constructor(private drizzleService: DrizzleService) {}

  async getMembers(oSlug: string) {
    return await this.drizzleService.db
      .select({
        id: organizationMembers.id,
        role: organizationMembers.role,
        createdAt: organizationMembers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatar: users.avatarUrl,
        },
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(
        and(
          eq(organizations.slug, oSlug),
          isNull(organizationMembers.removedAt),
        ),
      );
  }

  async updateRole(
    oSlug: string,
    memberId: string,
    dto: UpdateRoleInOrganizationDto,
  ) {
    if (dto.role === 'developer') {
      await this.dontRemoveLastAdmin(oSlug, memberId);
    }

    const [updated] = await this.drizzleService.db
      .update(organizationMembers)
      .set({ role: dto.role })
      .where(eq(organizationMembers.id, memberId))
      .returning();
    if (!updated) throw new NotFoundException('Member not found');
    return updated;
  }

  async removeMember(oSlug: string, memberId: string) {
    await this.dontRemoveLastAdmin(oSlug, memberId);

    const [updated] = await this.drizzleService.db
      .update(organizationMembers)
      .set({ removedAt: new Date() })
      .where(eq(organizationMembers.id, memberId))
      .returning();
    if (!updated) throw new NotFoundException('Member not found');
    return { message: 'Member removed successfully' };
  }

  private async dontRemoveLastAdmin(oSlug: string, memberId: string) {
    const admins = await this.drizzleService.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(
        and(
          eq(organizations.slug, oSlug),
          eq(organizationMembers.role, 'admin'),
          isNull(organizationMembers.removedAt),
        ),
      );
    const targetIsAdmin = admins.some((a) => a.id === memberId);
    if (targetIsAdmin && admins.length === 1) {
      throw new BadRequestException('You cannot remove the last admin');
    }
  }
}
