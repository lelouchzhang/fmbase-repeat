import { COOKIE_KEYS } from '@fmbase/constants';
import { AuthTokens, JwtPayload } from '@fmbase/types';
import { DrizzleService } from './../db/drizzle.service.js';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import slugify from 'slugify';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dto/register.dto.js';
import { users } from '../db/schema/users.js';
import { and, eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import {
  organizationMembers,
  organizations,
} from '../db/schema/organizations.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private config: ConfigService,
    private drizzle: DrizzleService,
    private jwt: JwtService,
  ) {}

  setCookies(res: Response, token: AuthTokens) {
    // check env'
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    // set cookies
    res.cookie(COOKIE_KEYS.ACCESS_TOKEN, token.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie(COOKIE_KEYS.REFRESH_TOKEN, token.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearCookies(res: Response) {
    res.clearCookie(COOKIE_KEYS.ACCESS_TOKEN);
    res.clearCookie(COOKIE_KEYS.REFRESH_TOKEN);
  }

  private generateOrganizationSlug(name: string): string {
    const base = slugify(`${name}-org`, { lower: true, strict: true });
    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  private signTokens(userId: string, email: string): AuthTokens {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    // exist?
    const existing = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [user] = await this.drizzle.db
      .insert(users)
      .values({
        email: dto.email,
        provider: 'email',
        passwordHash,
        name: dto.name,
      })
      .returning();

    const [organization] = await this.drizzle.db
      .insert(organizations)
      .values({
        name: `${dto.name}'s Organization`,
        slug: this.generateOrganizationSlug(dto.name),
      })
      .returning();
    await this.drizzle.db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
      role: 'admin',
    });
    return this.signTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.email, dto.email), eq(users.provider, 'email')))
      .limit(1);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(
        'Application not support this login method',
      );
    }
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    return this.signTokens(user.id, user.email);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const [user] = await this.drizzle.db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException('Something went wrong');
      }

      return this.signTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // OAuth
  async handleOAuthUser(profile: {
    email: string;
    name: string;
    avatarUrl: string | null;
    provider: 'google' | 'github';
    providerUserId: string;
  }): Promise<AuthTokens> {
    let [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.provider, profile.provider),
          eq(users.providerUserId, profile.providerUserId),
        ),
      )
      .limit(1);
    if (!user) {
      const [newUser] = await this.drizzle.db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        })
        .returning();
      user = newUser;
      const [organization] = await this.drizzle.db
        .insert(organizations)
        .values({
          name: `${profile.name}'s Organization`,
          slug: this.generateOrganizationSlug(profile.name),
        })
        .returning();

      await this.drizzle.db.insert(organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: 'admin',
      });
    }
    return this.signTokens(user.id, user.email);
  }

  // Google OAuth
  getGoogleAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      redirect_uri: this.config.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string): Promise<AuthTokens> {
    const tokenResponse = await fetch(`https://oauth2.googleapis.com/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
        redirect_uri: this.config.get<string>('GOOGLE_CALLBACK_URL') ?? '',
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenResponse.json()) satisfies {
      access_token: string;
    };

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const profile = (await profileResponse.json()) satisfies {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    return this.handleOAuthUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture ?? null,
      provider: 'google',
      providerUserId: profile.sub,
    });
  }

  // Github OAuth
  getGithubAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('GITHUB_CLIENT_ID')!,
      redirect_uri: this.config.get<string>('GITHUB_CALLBACK_URL')!,
      scope: 'read:user user:email',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGithubCallback(code: string): Promise<AuthTokens> {
    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.get<string>('GITHUB_CLIENT_ID'),
          client_secret: this.config.get<string>('GITHUB_CLIENT_SECRET'),
          code,
          redirect_uri: this.config.get<string>('GITHUB_CALLBACK_URL'),
        }),
      },
    );

    const tokenData = (await tokenRes.json()) satisfies {
      access_token: string;
    };

    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const profile = (await profileRes.json()) satisfies {
      id: number;
      email: string | null;
      name: string | null;
      login: string;
      avatar_url: string | null;
    };

    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const emails = (await emailRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
      // throw new UnauthorizedException(
      //   'GitHub account has no verified email. Please verify or publicize your GitHub email and retry.',
      // );
    }

    return this.handleOAuthUser({
      email: email!,
      name: profile.name ?? profile.login,
      avatarUrl: profile.avatar_url ?? null,
      provider: 'github',
      providerUserId: String(profile.id),
    });
  }
}
