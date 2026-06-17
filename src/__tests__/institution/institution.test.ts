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

const TEST_SUPER_ADMIN = {
  name: 'Super Admin',
  email: `super-${randomUUID()}@example.com`,
  password: 'Password1!',
};

let adminCookies: string[] = [];
let adminCsrfToken: string = '';
let targetOrgId = '';

before(async () => {
  await initRedis();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `${BASE}:${addr.port}`;
      resolve();
    });
  });

  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_SUPER_ADMIN),
  });

  await prismaClient.user.update({
    where: { email: TEST_SUPER_ADMIN.email },
    data: { role: 'SUPER_ADMIN' }
  });

  const loginAdmin = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_SUPER_ADMIN.email, password: TEST_SUPER_ADMIN.password }),
  });
  const loginBody = await loginAdmin.json() as any;
  console.log('[DEBUG] Login Admin Body:', loginBody);
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

const authedSuperAdmin = (extra?: Record<string, string>) => ({
  Cookie: adminCookies.join('; '),
  'x-csrf-token': adminCsrfToken,
  'Content-Type': 'application/json',
  ...extra,
});

describe('Institution Module API', () => {

  it('POST /organizations — creates an institution', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations`, {
      method: 'POST',
      headers: authedSuperAdmin(),
      body: JSON.stringify({
        name: 'University of Buildora',
        email: `contact-${randomUUID()}@ubuildora.edu`,
      }),
    });
    const body = await res.json() as any;
    if (res.status !== 201) console.error('[DEBUG] POST /organizations failed:', body);
    assert.equal(res.status, 201);
    assert.ok(body.data.id);
    assert.equal(body.data.name, 'University of Buildora');
    targetOrgId = body.data.id;
  });

  it('GET /organizations/:id — fetches an institution', async () => {
    assert.ok(targetOrgId);
    const res = await fetch(`${baseUrl}/api/v1/organizations/${targetOrgId}`, {
      method: 'GET',
      headers: authedSuperAdmin(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.data.id, targetOrgId);
  });

  it('PUT /organizations/:id — updates an institution', async () => {
    assert.ok(targetOrgId);
    const res = await fetch(`${baseUrl}/api/v1/organizations/${targetOrgId}`, {
      method: 'PUT',
      headers: authedSuperAdmin(),
      body: JSON.stringify({ name: 'University of Buildora - Global' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.data.name, 'University of Buildora - Global');
  });

  it('DELETE /organizations/:id — soft deletes an institution', async () => {
    assert.ok(targetOrgId);
    const res = await fetch(`${baseUrl}/api/v1/organizations/${targetOrgId}`, {
      method: 'DELETE',
      headers: authedSuperAdmin(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.message, 'Organization deleted successfully');
  });

});
