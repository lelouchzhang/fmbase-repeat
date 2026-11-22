import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import type { Response, Request } from 'express';
import { COOKIE_KEYS } from '@fmbase/constants';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '@fmbase/types';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(200)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    if (!tokens) throw new Error('Error while registering user');
    this.authService.setCookies(res, tokens);
    return { message: 'User registered successfully' };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    if (!tokens) throw new Error('Error while logging in user');
    this.authService.setCookies(res, tokens);
    return { message: 'User logged in successfully' };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearCookies(res);
    return { message: 'User logged out successfully' };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[COOKIE_KEYS.REFRESH_TOKEN];
    if (!refreshToken) throw new Error('Refresh token not found');
    const tokens = await this.authService.refreshTokens(refreshToken);
    if (!tokens) throw new Error('Failed to refresh tokens');
    this.authService.setCookies(res, tokens);
    return { message: 'Tokens refreshed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Get('google')
  @Redirect()
  GoogleLogin(@Query('next') next?: string) {
    return {
      url: this.authService.getGoogleAuthUrl(next),
    };
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.handleGoogleCallback(code);
    this.authService.setCookies(res, tokens);
    return res.redirect(this.webRedirectUrl(state));
  }

  @Get('github')
  @Redirect()
  githubLogin(@Query('next') next?: string) {
    return {
      url: this.authService.getGithubAuthUrl(next),
    };
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.handleGithubCallback(code);
    this.authService.setCookies(res, tokens);
    return res.redirect(this.webRedirectUrl(state));
  }

  /**
   * state 是不可信的外部输入：只放行站内相对路径，防止 open redirect。
   */
  private webRedirectUrl(state: string | undefined): string {
    const webUrl = this.configService.get<string>('WEB_URL') ?? '';
    if (!state) return `${webUrl}/dashboard`;
    const safe = decodeURIComponent(state);
    if (!safe.startsWith('/') || safe.startsWith('//') || safe.includes('\\')) {
      return `${webUrl}/dashboard`;
    }
    return `${webUrl}${safe}`;
  }
}
