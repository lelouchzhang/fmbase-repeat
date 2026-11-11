import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MembersService } from './members.service.js';
import { MembersController } from './members.controller.js';
import { InvitecodeService } from './invitecode.service.js';
import { InvitesController } from './invites.controller.js';

@Module({
  imports: [JwtModule.register({})],
  providers: [MembersService, InvitecodeService],
  controllers: [MembersController, InvitesController],
  exports: [MembersService],
})
export class MembersModule {}
