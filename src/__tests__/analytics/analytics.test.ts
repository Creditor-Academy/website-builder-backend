import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

import apiRoutes from '../../modules/api.routes.js';
import { errorHandler } from '../../middlewares/error.middleware.js';
import { initRedis } from '../../config/redis-client.js';
import prisma from '../../config/prisma.js';

const BASE = 'http://127.0.0.1';
let baseUrl = '';
let server: ReturnType<typeof app.listen>;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1', apiRoutes);
app.use(errorHandler);

const TEST_USER = {
  name: 'Analytics Tester',
  email: `analytics-${randomUUID()}@example.com`,
  password: 'Password1',
};

let userCookies: string[] = [];
let userCsrfToken: string = '';
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

  // Create a website
  const websiteRes = await fetch(`${baseUrl}/api/v1/websites`, {
    method: 'POST',
    headers: {
        Cookie: userCookies.join('; '),
        'x-csrf-token': userCsrfToken,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Analytics Test Site', template: 'blank' }),
  });
  const websiteBody = await websiteRes.json() as any;
  websiteId = websiteBody.website?.id || websiteBody.data?.id || websiteBody.id;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const userAuthed = (extra?: Record<string, string>) => ({
  Cookie: userCookies.join('; '),
  'x-csrf-token': userCsrfToken,
  'Content-Type': 'application/json',
  ...extra,
});

describe('Analytics API', () => {
  it('POST /analytics/track — publicly tracks a page view', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Agent',
      },
      body: JSON.stringify({
        websiteId,
        path: '/about-us',
        referrer: 'https://google.com',
      }),
    });
    
    // endpoint returns 204 No Content
    assert.equal(res.status, 204, await res.text());

    // Verify it was saved to DB
    const views = await prisma.pageView.findMany({
      where: { website_id: websiteId, path: '/about-us' }
    });
    assert.equal(views.length, 1, 'Should have inserted one page view');
    assert.equal(views[0]?.referrer, 'https://google.com');
  });

  it('GET /analytics/websites/:websiteId — returns aggregated analytics data', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/websites/${websiteId}?period=7d`, {
      headers: userAuthed(),
    });
    assert.equal(res.status, 200, await res.text());
    
    const body = await res.json() as any;
    assert.equal(body.websiteId, websiteId);
    assert.equal(body.period, '7d');
    assert.equal(body.totalViews, 1);
    
    assert.ok(Array.isArray(body.daily), 'Should return daily array');
    assert.ok(Array.isArray(body.topPages), 'Should return topPages array');
    assert.equal(body.topPages[0]?.path, '/about-us');
    assert.equal(body.topPages[0]?.views, 1);
  });

  it('GET /analytics/websites/:websiteId — prevents unauthorized access to analytics', async () => {
    // Generate a different user
    const BAD_USER = {
        name: 'Bad Analytics Tester',
        email: `bad-analytics-${randomUUID()}@example.com`,
        password: 'Password1',
    };
    await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(BAD_USER),
    });
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: BAD_USER.email, password: BAD_USER.password }),
    });
    const badCookies = loginRes.headers.getSetCookie().map(c => c.split(';')[0]!);
    
    const res = await fetch(`${baseUrl}/api/v1/analytics/websites/${websiteId}`, {
        headers: { Cookie: badCookies.join('; ') },
    });
    assert.equal(res.status, 403, 'Should return 403 Forbidden for a website the user does not own');
  });
});
