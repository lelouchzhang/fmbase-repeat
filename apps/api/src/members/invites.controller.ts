import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '@fmbase/types';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationRoleGuard } from '../common/guards/o-role.guard.js';
import { RequireOrgRole } from '../common/decorators/require-o-role.js';
import { AcceptInviteDto, InviteMemberDto } from './dto/member.dto.js';
import { InvitecodeService } from './invitecode.service.js';

@Controller('orgs')
export class InvitesController {
  constructor(private invitecodeService: InvitecodeService) {}

  @Post(':slug/invites')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, OrganizationRoleGuard)
  @RequireOrgRole('admin')
  sendInvite(@Param('slug') slug: string, @Body() dto: InviteMemberDto) {
    return this.invitecodeService.sendInviteEmail(slug, dto.email);
  }

  @Post('invites/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  acceptInvite(@CurrentUser() user: JwtPayload, @Body() dto: AcceptInviteDto) {
    return this.invitecodeService.acceptInvite(user, dto.token);
  }
}
