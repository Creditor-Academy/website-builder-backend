import type { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

export const validateRequest = (
  schema: ZodType<any>,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      req.validated = req.validated || {};
      req.validated[source] = parsed;
      next();

    } catch (error: any) {
      if (error instanceof ZodError) {
        const errorObject = (msg => {
          try { return JSON.parse(msg) }
          catch { return [{ path: [], message: msg }] }
        })(error.message);

        const errors = errorObject?.map((err: any) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        res.status(400).json({ error: 'Invalid data', errors });
      } else {
        res.status(500).json({ error: error.message || 'Internal Server Error' });
      }
    }
  };
}