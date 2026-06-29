import express from 'express';
import apiRoutes from './modules/api.routes.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { initRedis } from './config/redis-client.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { requestId } from './middlewares/request-id.middleware.js';
import { metricsMiddleware, metricsHandler } from './middlewares/metrics.middleware.js';
import { domainRouter } from './middlewares/domain-router.middleware.js';
import prismaClient from './config/prisma.js';

import { initCron } from './modules/cron.js';

// ─── Environment Validation ─────────────────────────────────────────────────
const requiredEnvVars = ['JWT_SECRET', 'POSTGRESQL_URL'] as const;
for (const name of requiredEnvVars) {
  if (!process.env[name]) {
    console.error(`FATAL: Required environment variable ${name} is not set.`);
    process.exit(1);
  }
}

// ─── Logger ──────────────────────────────────────────────────────────────────
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino/file', options: { destination: 1 } },
  }),
});

const app = express();

await initRedis();
initCron();

// ─── Security & Performance Middleware ───────────────────────────────────────
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(compression());
app.use(requestId);
app.use(metricsMiddleware);
app.use(pinoHttp({
  logger,
  autoLogging: false,
  genReqId: (req: any) => req.id,
}));

const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:8080,http://localhost:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const globalCors = cors({
  origin: (origin, callback) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!origin) {
      callback(null, true);
      return;
    }

    const isConfiguredOrigin = allowedOrigins.includes(origin);
    const isLocalDevelopmentOrigin = isDevelopment && localhostOriginPattern.test(origin);

    if (isConfiguredOrigin || isLocalDevelopmentOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
});

app.use((req, res, next) => {
  // Allow any origin for endpoints called from published sites
  const publicPaths = ['/api/v1/analytics/track', '/api/v1/forms/submit', '/api/v1/contact'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return cors()(req, res, next);
  }
  return globalCors(req, res, next);
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }))
app.use(cookieParser());

// ─── Domain Routing (custom domains & subdomains → published sites) ──────────
app.use(domainRouter);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.status(200).send('Buildora API is running'));

app.get('/api/v1/health', async (_req, res) => {
  try {
    await prismaClient.$queryRawUnsafe('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
  }
});

app.get('/api/v1/metrics', metricsHandler);

// ─── Client Error Reporting ──────────────────────────────────────────────────
const clientErrorCounts = new Map<string, { count: number; resetAt: number }>();
app.post('/api/v1/client-errors', (req, res) => {
  // Basic IP-based rate limiting: max 20 reports per minute per IP
  const ip = (req.ip || req.socket?.remoteAddress || 'unknown').substring(0, 64);
  const now = Date.now();
  const windowMs = 60_000;
  const entry = clientErrorCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    clientErrorCounts.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count++;
    if (entry.count > 20) {
      return res.status(429).end();
    }
  }
  // Sanitize and truncate fields to prevent log injection
  const truncate = (v: unknown, max = 500) => typeof v === 'string' ? v.slice(0, max) : undefined;
  logger.warn({
    clientError: {
      message: truncate(req.body?.message),
      stack: truncate(req.body?.stack, 1000),
      url: truncate(req.body?.url, 200),
      timestamp: truncate(req.body?.timestamp, 50),
    },
  }, 'Client-side error reported');
  res.status(204).end();
});

app.use('/api/v1', apiRoutes);

// ─── 404 Catch-All for API ────────────────────────────────────────────────────
app.use('/api/{*path}', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`App listening at Port: ${PORT}`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await prismaClient.$disconnect();
      logger.info('Database disconnected');
    } catch (err) {
      logger.error(err, 'Error during shutdown');
    }
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));