import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MembersService } from './members.service.js';
import { MembersController } from './members.controller.js';

@Module({
  imports: [JwtModule.register({})],
  providers: [MembersService],
  controllers: [MembersController],
  exports: [MembersService],
})
export class MembersModule {}
