import type { JwtPayload } from '@fmbase/types';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationsService } from './organizations.service.js';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/organization.dto.js';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get()
  getMyOrganizations(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.getMyOrganizations(user.sub);
  }

  @Get(':slug')
  getOrganizationBySlug(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
  ) {
    return this.organizationsService.getOrganizationBySlug(slug, user.sub);
  }

  @Post()
  createOrganization(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(dto, user.sub);
  }
}
