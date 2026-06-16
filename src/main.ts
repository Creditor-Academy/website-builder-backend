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
import path from 'path';

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

// ─── Security & Performance Middleware ───────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(requestId);
app.use(metricsMiddleware);
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req: any) => req.url === '/api/v1/health' },
  genReqId: (req: any) => req.id,
}));

const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:8080,http://localhost:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

app.use(cors({
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
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }))
app.use(cookieParser());

// Allow any origin for the analytics tracking endpoint (called from published sites)
app.options('/api/v1/analytics/track', cors());
app.use('/api/v1/analytics/track', cors());

// ─── Domain Routing (custom domains & subdomains → published sites) ──────────
app.use(domainRouter);

app.use('/uploads', express.static(path.resolve(process.cwd(), 'storage', 'assets', 'files')));
app.use('/sites', express.static(path.resolve(process.cwd(), 'storage', 'sites')));

// ─── Health Check ────────────────────────────────────────────────────────────
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
app.post('/api/v1/client-errors', (req, res) => {
  const { message, stack, componentStack, url, timestamp } = req.body || {};
  logger.warn({ clientError: { message, stack, componentStack, url, timestamp } }, 'Client-side error reported');
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