import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './db/drizzle.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DrizzleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
