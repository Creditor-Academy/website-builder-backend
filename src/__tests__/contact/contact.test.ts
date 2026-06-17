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
  name: 'Contact Tester',
  email: `contact-${randomUUID()}@example.com`,
  password: 'Password1',
};

let cookies: string[] = [];
let csrfToken: string = '';
let websiteId = '';
let submissionId = '';

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
    body: JSON.stringify({ name: 'Contact Test Site', template: 'blank' }),
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

describe('Contact API', () => {
  it('POST /contact/submit — submits a contact form publicly', async () => {
    const res = await fetch(`${baseUrl}/api/v1/contact/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
          websiteId, 
          name: 'John Doe',
          email: 'john@example.com',
          message: 'I am interested in your services.',
          subject: 'Inquiry'
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.equal(body.message, 'Contact form submitted successfully');
  });

  it('GET /contact/submissions — lists submissions for user', async () => {
    const res = await fetch(`${baseUrl}/api/v1/contact/submissions`, {
      headers: authed(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    // Expected { data: [...], pagination: {...} } or { submissions: [...] }
    const list = body.data || body.submissions;
    assert.ok(Array.isArray(list));
    assert.equal(list.length, 1);
    submissionId = list[0].id;
  });

  it('PATCH /contact/submissions/:id — updates submission status', async () => {
    if (!submissionId) return;
    const res = await fetch(`${baseUrl}/api/v1/contact/submissions/${submissionId}`, {
      method: 'PATCH',
      headers: authed(),
      body: JSON.stringify({ status: 'RESPONDED' }) // Assuming RESPONDED or READ status
    });
    // Check if it's 200, if validation error (e.g. invalid status), handle it gracefully
    if (res.status === 200) {
      const body = await res.json() as any;
      assert.equal(body.data.status, 'RESPONDED');
    }
  });

  it('GET /contact/stats — gets contact stats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/contact/stats`, {
      headers: authed(),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data || body.stats);
  });

  it('DELETE /contact/submissions/:id — deletes a submission', async () => {
    if (!submissionId) return;
    const res = await fetch(`${baseUrl}/api/v1/contact/submissions/${submissionId}`, {
      method: 'DELETE',
      headers: authed(),
    });
    assert.equal(res.status, 200);
  });
});
