import { COOKIE_KEYS } from '@fmbase/constants';
import { JwtPayload } from '@fmbase/types';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private config: ConfigService,
    private jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    const token = request.cookies?.[COOKIE_KEYS.ACCESS_TOKEN] as
      string | undefined;

    if (!token) {
      throw new UnauthorizedException('No authenticated');
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
