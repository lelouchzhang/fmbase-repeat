import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InvitePayload, JwtPayload } from '@fmbase/types';
import { and, eq, like } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service.js';
import {
  organizationMembers,
  organizations,
} from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';
import { InvitecodeService } from './invitecode.service.js';

const INVITER_EMAIL = 'invite-test-inviter@example.com';
const INVITEE_EMAIL = 'invite-test-invitee@example.com';
const TEST_ORG_PREFIX = 'InviteTest';

describe('InvitecodeService (login-gated accept)', () => {
  let inviteService: InvitecodeService;
  let drizzle: DrizzleService;
  let jwt: JwtService;

  function makeConfig() {
    return {
      get: <T>(key: string): T => process.env[key] as T,
    } as ConfigService;
  }

  async function createInviterWithOrg() {
    const config = makeConfig();
    const { AuthService } = await import('../auth/auth.service.js');
    const authService = new AuthService(config, drizzle, jwt);
    await authService.register({
      email: INVITER_EMAIL,
      password: 'password123',
      name: `${TEST_ORG_PREFIX}Inviter`,
    });
    const [inviter] = await drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, INVITER_EMAIL));
    const [org] = await drizzle.db
      .select()
      .from(organizations)
      .where(eq(organizations.name, `${TEST_ORG_PREFIX}Inviter's Organization`));
    return { inviter, org };
  }

  function signInviteToken(payload: InvitePayload): string {
    return jwt.sign(payload, {
      secret: process.env.INVITE_SECRET,
      expiresIn: process.env.INVITE_EXPIRES_IN ?? '24h',
    } as JwtSignOptions);
  }

  beforeAll(async () => {
    const config = makeConfig();
    drizzle = new DrizzleService(config);
    drizzle.onModuleInit();
    jwt = new JwtService();
    inviteService = new InvitecodeService(drizzle, jwt, config);
    // 避免测试发送真实邮件
    (inviteService as unknown as { resend: unknown }).resend = {
      emails: { send: async () => ({ id: 'test' }) },
    };
  });

  beforeEach(async () => {
    await drizzle.db
      .delete(users)
      .where(like(users.email, 'invite-test%'));
    await drizzle.db
      .delete(organizations)
      .where(like(organizations.name, `${TEST_ORG_PREFIX}%`));
  });

  describe('acceptInvite', () => {
    it('adds the logged-in user as developer member when invite email matches', async () => {
      const { org } = await createInviterWithOrg();
      const config = makeConfig();
      const { AuthService } = await import('../auth/auth.service.js');
      const authService = new AuthService(config, drizzle, jwt);
      await authService.register({
        email: INVITEE_EMAIL,
        password: 'password123',
        name: `${TEST_ORG_PREFIX}Invitee`,
      });
      const [invitee] = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, INVITEE_EMAIL));

      const token = signInviteToken({
        email: INVITEE_EMAIL,
        organizationId: org.id,
        organizationName: org.name,
      });
      const currentUser: JwtPayload = { sub: invitee.id, email: INVITEE_EMAIL };

      const result = await inviteService.acceptInvite(currentUser, token);
      expect(result.message).toBe('invite accepted');

      const [member] = await drizzle.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, org.id),
            eq(organizationMembers.userId, invitee.id),
          ),
        );
      expect(member.role).toBe('developer');
    });

    it('forbids when logged-in email does not match invite email', async () => {
      const { org } = await createInviterWithOrg();
      const token = signInviteToken({
        email: INVITEE_EMAIL,
        organizationId: org.id,
        organizationName: org.name,
      });
      const otherUser: JwtPayload = {
        sub: 'some-user-id',
        email: 'someone-else@example.com',
      };

      await expect(
        inviteService.acceptInvite(otherUser, token),
      ).rejects.toThrow('Invite email does not match your account');
    });

    it('rejects invalid token', async () => {
      const { org } = await createInviterWithOrg();
      await expect(
        inviteService.acceptInvite(
          { sub: 'x', email: INVITEE_EMAIL },
          'not-a-token',
        ),
      ).rejects.toThrow('invalid invite token');
    });

    it('rejects when user is already an active member', async () => {
      const { org } = await createInviterWithOrg();
      const config = makeConfig();
      const { AuthService } = await import('../auth/auth.service.js');
      const authService = new AuthService(config, drizzle, jwt);
      await authService.register({
        email: INVITEE_EMAIL,
        password: 'password123',
        name: `${TEST_ORG_PREFIX}Invitee`,
      });
      const [invitee] = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, INVITEE_EMAIL));

      const token = signInviteToken({
        email: INVITEE_EMAIL,
        organizationId: org.id,
        organizationName: org.name,
      });
      const currentUser: JwtPayload = { sub: invitee.id, email: INVITEE_EMAIL };

      await inviteService.acceptInvite(currentUser, token);
      await expect(
        inviteService.acceptInvite(currentUser, token),
      ).rejects.toThrow('user already exists in organization');
    });
  });

  describe('sendInviteEmail', () => {
    it('sends invite email and returns success', async () => {
      const { org } = await createInviterWithOrg();

      const result = await inviteService.sendInviteEmail(
        org.slug,
        INVITEE_EMAIL,
      );
      expect(result.message).toBe('invite sent');
    });

    it('rejects inviting an existing active member', async () => {
      const { org, inviter } = await createInviterWithOrg();

      await expect(
        inviteService.sendInviteEmail(org.slug, INVITER_EMAIL),
      ).rejects.toThrow('user already exists in organization');
      expect(inviter.email).toBe(INVITER_EMAIL);
    });

    it('rejects unknown organization slug', async () => {
      await expect(
        inviteService.sendInviteEmail('no-such-org', INVITEE_EMAIL),
      ).rejects.toThrow('organization not found');
    });
  });
});
