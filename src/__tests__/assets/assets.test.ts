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
  name: 'Assets Tester',
  email: `assets-${randomUUID()}@example.com`,
  password: 'Password1',
};

let userCookies: string[] = [];
let userCsrfToken: string = '';
let websiteId = '';
let assetId = '';

before(async () => {
  await initRedis();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `${BASE}:${addr.port}`;
      resolve();
    });
  });

  // Register User
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
  userCookies = loginRes.headers.getSetCookie().map(c => c.split(';')[0]!);

  const csrfRes = await fetch(`${baseUrl}/api/v1/csrf-token`, {
    headers: { Cookie: userCookies.join('; ') },
  });
  const csrfBody = await csrfRes.json() as any;
  userCsrfToken = csrfBody.token;
  userCookies.push(...csrfRes.headers.getSetCookie().map(c => c.split(';')[0]!));

  // Create a website to tie assets to
  const websiteRes = await fetch(`${baseUrl}/api/v1/websites`, {
    method: 'POST',
    headers: {
        Cookie: userCookies.join('; '),
        'x-csrf-token': userCsrfToken,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Assets Test Site', template: 'blank' }),
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

describe('Assets API', () => {
  it('GET /assets — returns empty list for new user', async () => {
    const res = await fetch(`${baseUrl}/api/v1/assets`, {
      headers: userAuthed(),
    });
    assert.equal(res.status, 200, await res.text());
    
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.assets), 'Should return an array of assets');
    assert.equal(body.assets.length, 0, 'Should have 0 assets initially');
  });

  it('POST /assets/import-url — successfully imports an asset from a URL', async () => {
    const res = await fetch(`${baseUrl}/api/v1/assets/import-url`, {
      method: 'POST',
      headers: userAuthed(),
      body: JSON.stringify({
        url: 'https://via.placeholder.com/150',
        websiteId,
      }),
    });
    
    assert.equal(res.status, 201, await res.text());
    const body = await res.json() as any;
    
    assert.ok(body.asset, 'Should return created asset');
    assert.equal(body.asset.type, 'image');
    
    assetId = body.asset.id;
  });

  it('GET /assets — returns the newly imported asset', async () => {
    const res = await fetch(`${baseUrl}/api/v1/assets`, {
      headers: userAuthed(),
    });
    assert.equal(res.status, 200, await res.text());
    
    const body = await res.json() as any;
    assert.equal(body.assets.length, 1, 'Should have 1 asset now');
    assert.equal(body.assets[0].id, assetId, 'Asset ID should match');
  });

  it('DELETE /assets/:id — successfully deletes the asset', async () => {
    const res = await fetch(`${baseUrl}/api/v1/assets/${assetId}`, {
      method: 'DELETE',
      headers: userAuthed(),
    });
    
    assert.equal(res.status, 200, await res.text());
    const body = await res.json() as any;
    assert.equal(body.message, 'Asset deleted successfully');
  });

  it('GET /assets — returns empty list again after deletion', async () => {
    const res = await fetch(`${baseUrl}/api/v1/assets`, {
      headers: userAuthed(),
    });
    const body = await res.json() as any;
    assert.equal(body.assets.length, 0, 'Should have 0 assets after deletion');
  });
});
