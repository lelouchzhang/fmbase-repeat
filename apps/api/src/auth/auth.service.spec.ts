import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq, like } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service.js';
import { accounts } from '../db/schema/accounts.js';
import { organizations } from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';
import { AuthService } from './auth.service.js';

const TEST_EMAIL = 'auth-test@example.com';
const TEST_EMAIL_2 = 'auth-test-2@example.com';
const TEST_ORG_PREFIX = 'AuthTest';

describe('AuthService (users + accounts model)', () => {
  let authService: AuthService;
  let drizzle: DrizzleService;

  beforeAll(async () => {
    const config = {
      get: <T>(key: string): T => process.env[key] as T,
    } as ConfigService;
    drizzle = new DrizzleService(config);
    drizzle.onModuleInit();
    authService = new AuthService(config, drizzle, new JwtService());
  });

  beforeEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    await drizzle.db
      .delete(users)
      .where(like(users.email, 'auth-test%'));
    await drizzle.db
      .delete(organizations)
      .where(like(organizations.name, `${TEST_ORG_PREFIX}%`));
  }

  describe('register', () => {
    it('creates user + email account + default org + admin member in one transaction', async () => {
      const tokens = await authService.register({
        email: TEST_EMAIL,
        password: 'password123',
        name: `${TEST_ORG_PREFIX}User`,
      });

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();

      const [user] = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, TEST_EMAIL));
      expect(user).toBeDefined();

      const [account] = await drizzle.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.id));
      expect(account.provider).toBe('email');
      expect(account.passwordHash).toBeTruthy();
      expect(account.providerUserId).toBeNull();
    });

    it('rejects duplicate email', async () => {
      await authService.register({
        email: TEST_EMAIL,
        password: 'password123',
        name: `${TEST_ORG_PREFIX}User`,
      });

      await expect(
        authService.register({
          email: TEST_EMAIL,
          password: 'password123',
          name: `${TEST_ORG_PREFIX}User`,
        }),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('login', () => {
    it('logs in with correct password', async () => {
      await authService.register({
        email: TEST_EMAIL,
        password: 'password123',
        name: `${TEST_ORG_PREFIX}User`,
      });

      const tokens = await authService.login({
        email: TEST_EMAIL,
        password: 'password123',
      });
      expect(tokens.accessToken).toBeTruthy();
    });

    it('rejects unknown email', async () => {
      await expect(
        authService.login({
          email: 'nobody@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Email or password is incorrect');
    });

    it('rejects wrong password', async () => {
      await authService.register({
        email: TEST_EMAIL,
        password: 'password123',
        name: `${TEST_ORG_PREFIX}User`,
      });

      await expect(
        authService.login({ email: TEST_EMAIL, password: 'wrong-password' }),
      ).rejects.toThrow('Email or password is incorrect');
    });

    it('rejects password login for OAuth-only user (no email account)', async () => {
      await authService.handleOAuthUser({
        email: TEST_EMAIL,
        name: `${TEST_ORG_PREFIX}OAuthUser`,
        avatarUrl: null,
        provider: 'google',
        providerUserId: 'google-sub-1',
      });

      await expect(
        authService.login({ email: TEST_EMAIL, password: 'password123' }),
      ).rejects.toThrow('Application not support this login method');
    });
  });

  describe('handleOAuthUser', () => {
    it('creates user + account + default org on first OAuth login', async () => {
      await authService.handleOAuthUser({
        email: TEST_EMAIL,
        name: `${TEST_ORG_PREFIX}GoogleUser`,
        avatarUrl: null,
        provider: 'google',
        providerUserId: 'google-sub-1',
      });

      const allUsers = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, TEST_EMAIL));
      expect(allUsers).toHaveLength(1);

      const [account] = await drizzle.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, allUsers[0].id));
      expect(account.provider).toBe('google');
      expect(account.providerUserId).toBe('google-sub-1');
    });

    it('returns same user on repeat OAuth login without duplicating org', async () => {
      await authService.handleOAuthUser({
        email: TEST_EMAIL,
        name: `${TEST_ORG_PREFIX}GoogleUser`,
        avatarUrl: null,
        provider: 'google',
        providerUserId: 'google-sub-1',
      });
      const [before] = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, TEST_EMAIL));

      await authService.handleOAuthUser({
        email: TEST_EMAIL,
        name: `${TEST_ORG_PREFIX}GoogleUser`,
        avatarUrl: null,
        provider: 'google',
        providerUserId: 'google-sub-1',
      });

      const after = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, TEST_EMAIL));
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe(before.id);
    });

    it('links new OAuth account to existing email-registered user (merge)', async () => {
      await authService.register({
        email: TEST_EMAIL,
        password: 'password123',
        name: `${TEST_ORG_PREFIX}User`,
      });
      const [before] = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, TEST_EMAIL));

      await authService.handleOAuthUser({
        email: TEST_EMAIL,
        name: `${TEST_ORG_PREFIX}User`,
        avatarUrl: null,
        provider: 'github',
        providerUserId: 'github-42',
      });

      const allUsers = await drizzle.db
        .select()
        .from(users)
        .where(eq(users.email, TEST_EMAIL));
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0].id).toBe(before.id);

      const userAccounts = await drizzle.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, before.id));
      expect(userAccounts).toHaveLength(2);
      expect(userAccounts.map((a) => a.provider).sort()).toEqual([
        'email',
        'github',
      ]);
    });

    it('keeps distinct users for distinct emails', async () => {
      await authService.handleOAuthUser({
        email: TEST_EMAIL,
        name: `${TEST_ORG_PREFIX}UserA`,
        avatarUrl: null,
        provider: 'google',
        providerUserId: 'google-sub-1',
      });
      await authService.handleOAuthUser({
        email: TEST_EMAIL_2,
        name: `${TEST_ORG_PREFIX}UserB`,
        avatarUrl: null,
        provider: 'google',
        providerUserId: 'google-sub-2',
      });

      const all = await drizzle.db
        .select()
        .from(users)
        .where(like(users.email, 'auth-test%'));
      expect(all).toHaveLength(2);
    });
  });
});
