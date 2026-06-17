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
  name: 'Stats Admin Tester',
  email: `admin-stats-${randomUUID()}@example.com`,
  password: 'Password1',
  role: 'ADMIN',
};

const TEST_USER = {
  name: 'Stats User Tester',
  email: `user-stats-${randomUUID()}@example.com`,
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

describe('Stats API', () => {
  it('GET /stats/dashboard — allows authenticated user to fetch stats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/stats/dashboard`, {
      headers: userAuthed(),
    });
    assert.equal(res.status, 200, await res.text());
    
    const body = await res.json() as any;
    assert.ok(typeof body.totalUsers === 'number', 'totalUsers should be a number');
    assert.ok(typeof body.totalWebsites === 'number', 'totalWebsites should be a number');
    // Basic user might have 0 institutions, but the endpoint shouldn't crash
  });

  it('GET /stats/dashboard — allows admin to fetch stats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/stats/dashboard`, {
      headers: adminAuthed(),
    });
    assert.equal(res.status, 200, await res.text());
    
    const body = await res.json() as any;
    assert.ok(typeof body.totalUsers === 'number', 'totalUsers should be a number');
    assert.ok(body.totalUsers >= 2, 'Should count at least the two users we created');
  });

  it('GET /stats/dashboard — rejects unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/api/v1/stats/dashboard`, {
      headers: {
        'x-csrf-token': adminCsrfToken,
      }
    });
    assert.equal(res.status, 401, 'Should return 401 Unauthorized');
  });
});
