import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE = 'http://127.0.0.1';
let baseUrl = '';
let server: ReturnType<typeof app.listen>;

const app = express();
app.use(express.json());
app.use(cookieParser());

// We import the real routes so validation, controllers, services are all exercised.
// If the DB / Redis are not available the tests will fail — that's intentional:
// these are integration tests.
import apiRoutes from '../../modules/api.routes.js';
import { errorHandler } from '../../middlewares/error.middleware.js';
import { initRedis } from '../../config/redis-client.js';

app.use('/api/v1', apiRoutes);
app.use(errorHandler);

const TEST_USER = {
  name: 'Test User',
  email: `test-${randomUUID()}@example.com`,
  password: 'Password1',
};

let cookies: string[] = [];

// ─── Lifecycle ───────────────────────────────────────────────────────────────

before(async () => {
  await initRedis();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `${BASE}:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Auth API', () => {
  it('POST /auth/register — creates a new user', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.ok(body.message);
  });

  it('POST /auth/register — rejects duplicate email', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });
    assert.equal(res.status, 409);
  });

  it('POST /auth/register — rejects weak password', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', email: 'x@x.com', password: 'short' }),
    });
    assert.equal(res.status, 400);
  });

  it('POST /auth/login — succeeds with correct creds', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.user);
    assert.ok(body.user.id);
    // Capture cookies for authenticated requests
    cookies = res.headers.getSetCookie();
    assert.ok(cookies.length > 0, 'should set cookies');
  });

  it('POST /auth/login — fails with wrong password', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER.email, password: 'WrongPass1' }),
    });
    assert.ok([401, 400].includes(res.status));
  });

  it('POST /auth/login — fails with missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER.email }),
    });
    assert.equal(res.status, 400);
  });

  it('GET /auth/logout — succeeds when authenticated', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      headers: { Cookie: cookies.join('; ') },
    });
    assert.equal(res.status, 200);
  });

  it('GET /auth/logout — fails when not authenticated', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/logout`);
    assert.equal(res.status, 401);
  });
});
