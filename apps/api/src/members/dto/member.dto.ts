import { ORGANIZATION_ROLES } from '@fmbase/constants';
import type { RoleInOrganization } from '@fmbase/types';
import { IsEmail, IsEnum } from 'class-validator';

export class UpdateRoleInOrganizationDto {
  @IsEnum(ORGANIZATION_ROLES)
  role: RoleInOrganization;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;
}
