import type { Request, Response, NextFunction } from 'express';

const metrics = {
  requestCount: 0,
  errorCount: 0,
  statusCodes: {} as Record<number, number>,
  startTime: Date.now(),
};

export const metricsMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  metrics.requestCount++;
  res.on('finish', () => {
    const code = res.statusCode;
    metrics.statusCodes[code] = (metrics.statusCodes[code] || 0) + 1;
    if (code >= 500) metrics.errorCount++;
  });
  next();
};

export const metricsHandler = (_req: Request, res: Response) => {
  res.json({
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    requestCount: metrics.requestCount,
    errorCount: metrics.errorCount,
    statusCodes: metrics.statusCodes,
  });
};
