import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service.js';
import { Reflector } from '@nestjs/core';
import { ORG_ROLE_KEY } from '@fmbase/constants';
import { JwtPayload, RoleInOrganization } from '@fmbase/types';
import { Request } from 'express';
import {
  organizationMembers,
  organizations,
} from '../../db/schema/organizations.js';
import { and, eq, isNull } from 'drizzle-orm';

interface AuthenticetedRequest extends Request {
  user: JwtPayload;
  roleInThisOrg?: RoleInOrganization;
}

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(
    private drizzleService: DrizzleService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.get<RoleInOrganization>(
      ORG_ROLE_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<AuthenticetedRequest>();
    const user = request.user;
    const oSlug = request.params['slug'] as string;

    const [member] = await this.drizzleService.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(
        and(
          eq(organizations.slug, oSlug),
          eq(organizationMembers.userId, user.sub),
          isNull(organizationMembers.removedAt),
        ),
      )
      .limit(1);

    if (!member) throw new NotFoundException('Organization not found');

    if (requiredRole && member.role !== requiredRole) {
      throw new ForbiddenException('Insufficient permissions');
    }
    request.roleInThisOrg = member.role;
    return true;
  }
}
