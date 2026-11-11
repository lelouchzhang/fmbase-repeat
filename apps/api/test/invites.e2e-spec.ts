import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async () => ({ id: 'test-email' }),
    };
  },
}));

describe('Invites flow (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const run = Date.now();
  const inviterEmail = `e2e-inviter-${run}@example.com`;
  const inviteeEmail = `e2e-invitee-${run}@example.com`;
  const otherEmail = `e2e-other-${run}@example.com`;

  function cookieOf(res: request.Response): string {
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return '';
    return setCookie.map((c) => c.split(';')[0]).join('; ');
  }

  async function register(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: `E2E ${run}` });
    expect(res.status).toBe(200);
    return cookieOf(res);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [(await import('../src/app.module.js')).AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwt = new JwtService();
  });

  afterAll(async () => {
    await app.close();
  });

  it('full flow: invite → login → accept → member appears with developer role', async () => {
    const inviterCookie = await register(inviterEmail);

    const orgsRes = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Cookie', inviterCookie);
    expect(orgsRes.status).toBe(200);
    const org = orgsRes.body.find((o: { role: string }) => o.role === 'admin');
    expect(org).toBeDefined();

    const sendRes = await request(app.getHttpServer())
      .post(`/api/orgs/${org.slug}/invites`)
      .set('Cookie', inviterCookie)
      .send({ email: inviteeEmail });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.message).toBe('invite sent');

    const inviteeCookie = await register(inviteeEmail);

    const token = jwt.sign(
      {
        email: inviteeEmail,
        organizationId: org.id,
        organizationName: org.name,
      },
      { secret: process.env.INVITE_SECRET, expiresIn: '24h' } as never,
    );

    const acceptRes = await request(app.getHttpServer())
      .post('/api/orgs/invites/accept')
      .set('Cookie', inviteeCookie)
      .send({ token });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.message).toBe('invite accepted');

    const membersRes = await request(app.getHttpServer())
      .get(`/api/orgs/${org.slug}/members`)
      .set('Cookie', inviterCookie);
    expect(membersRes.status).toBe(200);
    const inviteeMember = membersRes.body.find(
      (m: { user: { email: string } }) => m.user.email === inviteeEmail,
    );
    expect(inviteeMember).toBeDefined();
    expect(inviteeMember.role).toBe('developer');
  });

  it('rejects accept when logged-in email does not match invite email (403)', async () => {
    const inviterCookie = await register(`e2e-inviter2-${run}@example.com`);
    const orgsRes = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Cookie', inviterCookie);
    const org = orgsRes.body[0];

    const otherCookie = await register(otherEmail);
    const token = jwt.sign(
      {
        email: inviteeEmail,
        organizationId: org.id,
        organizationName: org.name,
      },
      { secret: process.env.INVITE_SECRET, expiresIn: '24h' } as never,
    );

    const res = await request(app.getHttpServer())
      .post('/api/orgs/invites/accept')
      .set('Cookie', otherCookie)
      .send({ token });
    expect(res.status).toBe(403);
  });

  it('rejects accept without login (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orgs/invites/accept')
      .send({ token: 'whatever-token' });
    expect(res.status).toBe(401);
  });

  it('rejects accept with invalid token (400)', async () => {
    const inviteeCookie = await register(`e2e-invitee3-${run}@example.com`);
    const res = await request(app.getHttpServer())
      .post('/api/orgs/invites/accept')
      .set('Cookie', inviteeCookie)
      .send({ token: 'not-a-valid-token' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate accept (400)', async () => {
    const inviterCookie = await register(`e2e-inviter4-${run}@example.com`);
    const orgsRes = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Cookie', inviterCookie);
    const org = orgsRes.body[0];

    const inviteeCookie = await register(`e2e-invitee4-${run}@example.com`);
    const token = jwt.sign(
      {
        email: `e2e-invitee4-${run}@example.com`,
        organizationId: org.id,
        organizationName: org.name,
      },
      { secret: process.env.INVITE_SECRET, expiresIn: '24h' } as never,
    );

    const first = await request(app.getHttpServer())
      .post('/api/orgs/invites/accept')
      .set('Cookie', inviteeCookie)
      .send({ token });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post('/api/orgs/invites/accept')
      .set('Cookie', inviteeCookie)
      .send({ token });
    expect(second.status).toBe(400);
  });

  it('rejects send invite from non-admin member (403)', async () => {
    const inviterCookie = await register(`e2e-inviter5-${run}@example.com`);
    const orgsRes = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Cookie', inviterCookie);
    const org = orgsRes.body[0];

    const developerCookie = await register(`e2e-dev5-${run}@example.com`);
    const token = jwt.sign(
      {
        email: `e2e-dev5-${run}@example.com`,
        organizationId: org.id,
        organizationName: org.name,
      },
      { secret: process.env.INVITE_SECRET, expiresIn: '24h' } as never,
    );
    await request(app.getHttpServer())
      .post('/api/orgs/invites/accept')
      .set('Cookie', developerCookie)
      .send({ token });

    const res = await request(app.getHttpServer())
      .post(`/api/orgs/${org.slug}/invites`)
      .set('Cookie', developerCookie)
      .send({ email: `e2e-new5-${run}@example.com` });
    expect(res.status).toBe(403);
  });
});
