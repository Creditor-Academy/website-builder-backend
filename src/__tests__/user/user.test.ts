import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

import apiRoutes from '../../modules/api.routes.js';
import { errorHandler } from '../../middlewares/error.middleware.js';
import { initRedis } from '../../config/redis-client.js';
import prismaClient from '../../config/prisma.js';

const BASE = 'http://127.0.0.1';
let baseUrl = '';
let server: ReturnType<typeof app.listen>;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1', apiRoutes);
app.use(errorHandler);

const TEST_USER = {
  name: 'Standard User',
  email: `user-${randomUUID()}@example.com`,
  password: 'Password1!',
};

const TEST_ADMIN = {
  name: 'Admin User',
  email: `admin-${randomUUID()}@example.com`,
  password: 'Password1!',
};

let userCookies: string[] = [];
let userCsrfToken: string = '';
let adminCookies: string[] = [];
let adminCsrfToken: string = '';
let targetUserId = '';

before(async () => {
  await initRedis();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `${BASE}:${addr.port}`;
      resolve();
    });
  });

  // 1. Register & Login Standard User
  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });

  const loginUser = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });
  const loginBody = await loginUser.json() as any;
  targetUserId = loginBody.user.id;
  userCookies = loginUser.headers.getSetCookie().map(c => c.split(';')[0]!);

  const csrfResUser = await fetch(`${baseUrl}/api/v1/csrf-token`, {
    headers: { Cookie: userCookies.join('; ') },
  });
  const csrfUserBody = await csrfResUser.json() as any;
  userCsrfToken = csrfUserBody.token;
  userCookies.push(...csrfResUser.headers.getSetCookie().map(c => c.split(';')[0]!));

  // 2. Register, Elevate, & Login Admin User
  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_ADMIN),
  });

  await prismaClient.user.update({
    where: { email: TEST_ADMIN.email },
    data: { role: 'ADMIN' }
  });

  const loginAdmin = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
  });
  adminCookies = loginAdmin.headers.getSetCookie().map(c => c.split(';')[0]!);

  const csrfResAdmin = await fetch(`${baseUrl}/api/v1/csrf-token`, {
    headers: { Cookie: adminCookies.join('; ') },
  });
  const csrfAdminBody = await csrfResAdmin.json() as any;
  adminCsrfToken = csrfAdminBody.token;
  adminCookies.push(...csrfResAdmin.headers.getSetCookie().map(c => c.split(';')[0]!));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const authedUser = (extra?: Record<string, string>) => ({
  Cookie: userCookies.join('; '),
  'x-csrf-token': userCsrfToken,
  'Content-Type': 'application/json',
  ...extra,
});

const authedAdmin = (extra?: Record<string, string>) => ({
  Cookie: adminCookies.join('; '),
  'x-csrf-token': adminCsrfToken,
  'Content-Type': 'application/json',
  ...extra,
});

describe('User Module API', () => {

  it('GET /users/me — fetches own profile', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'GET',
      headers: authedUser(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.user.email, TEST_USER.email);
    assert.equal(body.user.name, TEST_USER.name);
  });

  it('PUT /users/me — updates own profile', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PUT',
      headers: authedUser(),
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.user.name, 'Updated Name');
  });

  it('GET /users/:id — rejects standard users from fetching others', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/${targetUserId}`, {
      method: 'GET',
      headers: authedUser(),
    });
    // Requires ADMIN or INSTITUTION_ADMIN, so should get 403 Forbidden
    assert.equal(res.status, 403);
  });

  it('GET /users/:id — allows ADMIN to fetch any profile', async () => {
    assert.ok(targetUserId, 'Target user ID must exist');
    const res = await fetch(`${baseUrl}/api/v1/users/${targetUserId}`, {
      method: 'GET',
      headers: authedAdmin(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.user.id, targetUserId);
    assert.equal(body.user.email, TEST_USER.email);
  });

});
