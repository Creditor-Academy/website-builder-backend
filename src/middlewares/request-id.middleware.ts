import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};
