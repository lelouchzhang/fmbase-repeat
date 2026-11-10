import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InvitePayload } from '@fmbase/types';
import { Resend } from 'resend';
import { DrizzleService } from '../db/drizzle.service.js';
import {
  organizationMembers,
  organizations,
} from '../db/schema/organizations.js';
import { and, eq, isNull } from 'drizzle-orm';
import { users } from '../db/schema/users.js';

@Injectable()
export class InvitecodeService {
  private resend: Resend;
  constructor(
    private drizzleService: DrizzleService,
    private JwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendInviteEmail(oSlug: string, email: string) {
    const [organization] = await this.drizzleService.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, oSlug))
      .limit(1);

    if (!organization) throw new BadRequestException('organization not found');

    // 不可靠的判定方式
    const existingUser = await this.drizzleService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      const existingMember = await this.drizzleService.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organization.id),
            eq(organizationMembers.userId, existingUser[0].id),
            isNull(organizationMembers.removedAt),
          ),
        )
        .limit(1);
      if (existingMember.length > 0) {
        throw new BadRequestException('user already exists in organization');
      }
    }

    const inviteToken = this.JwtService.sign(
      {
        email,
        organizationId: organization.id,
        organizationName: organization.name,
      } satisfies InvitePayload,
      {
        secret: this.configService.get<string>('JWT_INVITE_SECRET'),
        expiresIn: this.configService.get('JWT_INVITE_EXPIRES_IN'),
      },
    );

    // send email
    const inviteUrl = `${this.configService.get<string>('API_URL')}/auth/invite/accept?token=${inviteToken}`;

    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `You've been invited to join ${organization.name} on Supavolt`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're invited to join ${organization.name}</h2>
          <p>Someone has invited you to collaborate on Supavolt.</p>
          <a
            href="${inviteUrl}"
            style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Accept invite
          </a>
          <p style="color: #999; font-size: 13px;">This link expires in 24 hours.</p>
        </div>
      `,
    });

    return {
      message: 'invite sent',
    };
  }

  async acceptInvite(token: string) {
    let payload: InvitePayload;

    try {
      payload = this.JwtService.verify<InvitePayload>(token, {
        secret: this.configService.get<string>('JWT_INVITE_SECRET'),
      });
    } catch {
      throw new BadRequestException('invalid invite token');
    }

    await this.drizzleService.db.transaction(async (tx) => {
      // 拿到或创建用户
      let [user] = await tx
        .insert(users)
        .values({
          email: payload.email,
          provider: 'email',
        })
        .onConflictDoNothing({ target: users.email })
        .returning({
          id: users.id,
          email: users.email,
        });

      if (!user) {
        [user] = await tx
          .select({
            id: users.id,
            email: users.email,
          })
          .from(users)
          .where(eq(users.email, payload.email))
          .limit(1);
      }

      // 重构时删掉，直接用已登录的被邀请用户的userId写入oms
      const result = await tx
        .insert(organizationMembers)
        .values({
          organizationId: payload.organizationId,
          userId: user.id,
          role: 'developer',
        })
        .onConflictDoNothing({
          target: [
            organizationMembers.organizationId,
            organizationMembers.userId,
          ],
          where: isNull(organizationMembers.removedAt),
        })
        .returning({ id: organizationMembers.id });

      if (result.length === 0) {
        throw new BadRequestException('user already exists in organization');
      }
    });
    return { message: 'invite accepted', email: payload.email };
  }
}
