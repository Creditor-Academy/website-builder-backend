import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error.utils.js';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        req.log?.warn({ err, statusCode: err.statusCode }, err.message);
        return res.status(err.statusCode).json({ error: err.message, message: err.message });
    }

    // Unexpected Error — log full stack, return generic message
    req.log?.error({ err, stack: err.stack }, 'Unhandled error');
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
}