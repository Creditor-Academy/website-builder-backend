import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

import apiRoutes from '../modules/api.routes.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import { initRedis } from '../config/redis-client.js';

const BASE = 'http://127.0.0.1';
let baseUrl = '';
let server: ReturnType<typeof app.listen>;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1', apiRoutes);
app.use(errorHandler);

const TEST_USER = {
  name: 'Website Tester',
  email: `web-${randomUUID()}@example.com`,
  password: 'Password1',
};

let cookies: string[] = [];
let websiteId = '';

before(async () => {
  await initRedis();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `${BASE}:${addr.port}`;
      resolve();
    });
  });

  // Register + login
  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });
  cookies = loginRes.headers.getSetCookie();
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const authed = (extra?: Record<string, string>) => ({
  Cookie: cookies.join('; '),
  'Content-Type': 'application/json',
  ...extra,
});

describe('Website API', () => {
  it('POST /websites — creates a website', async () => {
    const res = await fetch(`${baseUrl}/api/v1/websites`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ name: 'My Test Site', template: 'blank' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.ok(body.website?.id || body.data?.id || body.id);
    websiteId = body.website?.id || body.data?.id || body.id;
  });

  it('POST /websites — rejects missing name', async () => {
    const res = await fetch(`${baseUrl}/api/v1/websites`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it('POST /websites — rejects unauthenticated', async () => {
    const res = await fetch(`${baseUrl}/api/v1/websites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope' }),
    });
    assert.equal(res.status, 401);
  });

  it('GET /websites — lists my websites', async () => {
    const res = await fetch(`${baseUrl}/api/v1/websites`, {
      headers: authed(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    // Response shape: { websites: { websites: [...], pagination: {...} } }
    const inner = body.websites;
    const list = Array.isArray(inner) ? inner : inner?.websites;
    assert.ok(Array.isArray(list));
  });

  it('GET /websites/:id — gets single website', async () => {
    if (!websiteId) return;
    const res = await fetch(`${baseUrl}/api/v1/websites/${websiteId}`, {
      headers: authed(),
    });
    assert.equal(res.status, 200);
  });

  it('PATCH /websites/:id — updates website', async () => {
    if (!websiteId) return;
    const res = await fetch(`${baseUrl}/api/v1/websites/${websiteId}`, {
      method: 'PATCH',
      headers: authed(),
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    assert.equal(res.status, 200);
  });

  it('DELETE /websites/:id — soft-deletes website', async () => {
    if (!websiteId) return;
    const res = await fetch(`${baseUrl}/api/v1/websites/${websiteId}`, {
      method: 'DELETE',
      headers: authed(),
    });
    assert.equal(res.status, 200);
  });

  it('POST /websites/:id/restore — restores website', async () => {
    if (!websiteId) return;
    const res = await fetch(`${baseUrl}/api/v1/websites/${websiteId}/restore`, {
      method: 'POST',
      headers: authed(),
    });
    assert.equal(res.status, 200);
  });
});
