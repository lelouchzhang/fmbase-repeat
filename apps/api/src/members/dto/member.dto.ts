import { ORGANIZATION_ROLES } from '@fmbase/constants';
import type { RoleInOrganization } from '@fmbase/types';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class UpdateRoleInOrganizationDto {
  @IsEnum(ORGANIZATION_ROLES)
  role: RoleInOrganization;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(10)
  token: string;
}
