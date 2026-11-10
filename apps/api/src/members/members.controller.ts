import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationRoleGuard } from '../common/guards/o-role.guard.js';
import { MembersService } from './members.service.js';
import { RequireOrgRole } from '../common/decorators/require-o-role.js';
import { UpdateRoleInOrganizationDto } from './dto/member.dto.js';

@Controller('orgs/:slug/members')
@UseGuards(JwtAuthGuard, OrganizationRoleGuard)
export class MembersController {
  constructor(private membersService: MembersService) {}

  @Get()
  getMembers(@Param('slug') slug: string) {
    return this.membersService.getMembers(slug);
  }

  @Patch(':memberId/role')
  @RequireOrgRole('admin')
  updateRole(
    @Param('slug') slug: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateRoleInOrganizationDto,
  ) {
    return this.membersService.updateRole(slug, memberId, dto);
  }

  @Delete(':memberId')
  @RequireOrgRole('admin')
  removeMember(
    @Param('slug') slug: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.removeMember(slug, memberId);
  }
}
