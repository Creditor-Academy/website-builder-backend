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

const TEST_USER = {
  name: 'Forms Tester',
  email: `forms-${randomUUID()}@example.com`,
  password: 'Password1',
};

let cookies: string[] = [];
let csrfToken: string = '';
let websiteId = '';
let formSubmissionId = '';

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
  cookies = loginRes.headers.getSetCookie().map(c => c.split(';')[0]!);

  const csrfRes = await fetch(`${baseUrl}/api/v1/csrf-token`, {
    headers: { Cookie: cookies.join('; ') },
  });
  const csrfBody = await csrfRes.json() as any;
  csrfToken = csrfBody.token;
  cookies.push(...csrfRes.headers.getSetCookie().map(c => c.split(';')[0]!));

  // Create a website
  const websiteRes = await fetch(`${baseUrl}/api/v1/websites`, {
    method: 'POST',
    headers: {
        Cookie: cookies.join('; '),
        'x-csrf-token': csrfToken,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Forms Test Site', template: 'blank' }),
  });
  const websiteBody = await websiteRes.json() as any;
  websiteId = websiteBody.website?.id || websiteBody.data?.id || websiteBody.id;
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

describe('Forms API', () => {
  it('POST /forms/submit — creates a form submission publicly', async () => {
    const res = await fetch(`${baseUrl}/api/v1/forms/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Note: form submits usually require websiteId and data
      body: JSON.stringify({ 
          website_id: websiteId, 
          data: { email: 'test@example.com', message: 'Hello World' },
          page_slug: '/contact'
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.equal(body.message, 'Form submitted successfully');
  });

  it('GET /forms/submissions — lists form submissions (authenticated)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/forms/submissions`, {
      headers: authed(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 1);
    formSubmissionId = body.data[0].id;
  });

  it('PATCH /forms/:id/read — marks submission as read', async () => {
    if (!formSubmissionId) return;
    const res = await fetch(`${baseUrl}/api/v1/forms/${formSubmissionId}/read`, {
      method: 'PATCH',
      headers: authed(),
      body: JSON.stringify({ isRead: true })
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.data.is_read, true);
  });
});
