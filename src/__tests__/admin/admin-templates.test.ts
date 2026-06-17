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

const TEST_ADMIN = {
  name: 'Super Admin',
  email: `admin-${randomUUID()}@example.com`,
  password: 'Password1!',
};

let cookies: string[] = [];
let csrfToken: string = '';
let templateId = '';

before(async () => {
  await initRedis();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `${BASE}:${addr.port}`;
      resolve();
    });
  });

  // 1. Register user
  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_ADMIN),
  });

  // 2. Elevate user to SUPER_ADMIN via Prisma bypass
  await prismaClient.user.update({
    where: { email: TEST_ADMIN.email },
    data: { role: 'SUPER_ADMIN' }
  });

  // 3. Login to get admin session cookies
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
  });
  cookies = loginRes.headers.getSetCookie().map(c => c.split(';')[0]!);

  // 4. Fetch CSRF token
  const csrfRes = await fetch(`${baseUrl}/api/v1/csrf-token`, {
    headers: { Cookie: cookies.join('; ') },
  });
  const csrfBody = await csrfRes.json() as any;
  csrfToken = csrfBody.token;
  cookies.push(...csrfRes.headers.getSetCookie().map(c => c.split(';')[0]!));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const authed = (extra?: Record<string, string>) => ({
  Cookie: cookies.join('; '),
  'x-csrf-token': csrfToken,
  'Content-Type': 'application/json',
  ...extra,
});

describe('Admin Website Templates API', () => {

  it('POST /templates/websites — creates a global template', async () => {
    const payload = {
        name: 'Enterprise Tech',
        description: 'A dark mode template for tech companies.',
        category: 'Technology',
        global_styles: { theme: 'dark' }
    };

    const res = await fetch(`${baseUrl}/api/v1/templates/websites`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify(payload),
    });
    
    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.ok(body.data?.id);
    assert.equal(body.data.scope, 'GLOBAL');
    
    templateId = body.data.id;
  });

  it('GET /templates/websites/:id — fetches the template details', async () => {
    assert.ok(templateId, 'Template ID must be set from previous test');

    const res = await fetch(`${baseUrl}/api/v1/templates/websites/${templateId}`, {
      method: 'GET',
      headers: authed(),
    });
    
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.data.id, templateId);
    assert.equal(body.data.name, 'Enterprise Tech');
  });

  it('PATCH /templates/websites/:id — updates the template', async () => {
    assert.ok(templateId, 'Template ID must be set');

    const res = await fetch(`${baseUrl}/api/v1/templates/websites/${templateId}`, {
      method: 'PATCH',
      headers: authed(),
      body: JSON.stringify({ name: 'Enterprise Tech V2' }),
    });
    
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Enterprise Tech V2');
  });

  it('DELETE /templates/websites/:id — soft deletes the template', async () => {
    assert.ok(templateId, 'Template ID must be set');

    const res = await fetch(`${baseUrl}/api/v1/templates/websites/${templateId}`, {
      method: 'DELETE',
      headers: authed(),
    });
    
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.message, 'Template deleted successfully');
  });

});
