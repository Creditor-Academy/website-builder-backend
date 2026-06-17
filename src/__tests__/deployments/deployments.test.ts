import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

import apiRoutes from '../../modules/api.routes.js';
import { errorHandler } from '../../middlewares/error.middleware.js';
import { initRedis } from '../../config/redis-client.js';

const BASE = 'http://127.0.0.1';
let baseUrl = '';
let server: ReturnType<typeof app.listen>;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1', apiRoutes);
app.use(errorHandler);

const TEST_ADMIN = {
  name: 'Deploy Admin Tester',
  email: `admin-deploy-${randomUUID()}@example.com`,
  password: 'Password1',
  role: 'ADMIN',
};

const TEST_USER = {
  name: 'Deploy User Tester',
  email: `user-deploy-${randomUUID()}@example.com`,
  password: 'Password1',
};

let adminCookies: string[] = [];
let adminCsrfToken: string = '';

let userCookies: string[] = [];
let userCsrfToken: string = '';

before(async () => {
  await initRedis();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `${BASE}:${addr.port}`;
      resolve();
    });
  });

  // Register Admin
  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_ADMIN),
  });
  const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
  });
  adminCookies = adminLoginRes.headers.getSetCookie().map(c => c.split(';')[0]!);

  const adminCsrfRes = await fetch(`${baseUrl}/api/v1/csrf-token`, {
    headers: { Cookie: adminCookies.join('; ') },
  });
  const adminCsrfBody = await adminCsrfRes.json() as any;
  adminCsrfToken = adminCsrfBody.token;
  adminCookies.push(...adminCsrfRes.headers.getSetCookie().map(c => c.split(';')[0]!));

  // Register Standard User
  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });
  const userLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });
  userCookies = userLoginRes.headers.getSetCookie().map(c => c.split(';')[0]!);

  const userCsrfRes = await fetch(`${baseUrl}/api/v1/csrf-token`, {
    headers: { Cookie: userCookies.join('; ') },
  });
  const userCsrfBody = await userCsrfRes.json() as any;
  userCsrfToken = userCsrfBody.token;
  userCookies.push(...userCsrfRes.headers.getSetCookie().map(c => c.split(';')[0]!));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const adminAuthed = (extra?: Record<string, string>) => ({
  Cookie: adminCookies.join('; '),
  'x-csrf-token': adminCsrfToken,
  'Content-Type': 'application/json',
  ...extra,
});

const userAuthed = (extra?: Record<string, string>) => ({
  Cookie: userCookies.join('; '),
  'x-csrf-token': userCsrfToken,
  'Content-Type': 'application/json',
  ...extra,
});

describe('Deployments API', () => {
  it('GET /deployments — allows admin to list all platform deployments', async () => {
    const res = await fetch(`${baseUrl}/api/v1/deployments`, {
      headers: adminAuthed(),
    });
    assert.equal(res.status, 200, await res.text());
    
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.deployments), 'Should return an array of deployments');
    assert.ok(typeof body.total === 'number', 'Should return total count');
  });

  it('GET /deployments/stats — allows admin to get deployment statistics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/deployments/stats`, {
      headers: adminAuthed(),
    });
    assert.equal(res.status, 200, await res.text());
    
    const body = await res.json() as any;
    assert.ok(typeof body.total === 'number', 'total should be a number');
    assert.ok(typeof body.active === 'number', 'active should be a number');
    assert.ok(typeof body.failed === 'number', 'failed should be a number');
  });

  it('GET /deployments — prevents standard users from listing platform deployments', async () => {
    const res = await fetch(`${baseUrl}/api/v1/deployments`, {
      headers: userAuthed(),
    });
    assert.equal(res.status, 403, 'Standard user should get 403 Forbidden');
  });

  it('GET /deployments/stats — prevents standard users from getting deployment stats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/deployments/stats`, {
      headers: userAuthed(),
    });
    assert.equal(res.status, 403, 'Standard user should get 403 Forbidden');
  });
});
