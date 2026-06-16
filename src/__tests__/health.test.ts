import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const BASE = 'http://127.0.0.1';
let baseUrl = '';
const app = express();
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
let server: ReturnType<typeof app.listen>;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') baseUrl = `${BASE}:${addr.port}`;
      resolve();
    });
  });
});

after(() => server?.close());

describe('Health endpoint', () => {
  it('GET /api/v1/health — returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp);
  });
});
