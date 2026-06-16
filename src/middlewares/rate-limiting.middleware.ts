import type { Request, Response, NextFunction } from "express";
import cacheService from "../services/cache.service.js";

/**
 * Rate limits API requests per identifier
 * @param prefix - route or service name
 * @param identifier - user identifier (IP/email/session)
 * @param limit - number of requests allowed per window
 * @param window - time period to limit requests
 */
export const rateLimiting = (prefix: string, rate_limit: { LIMIT: number, WINDOW_SEC: number }) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Skip rate limiting for SUPER_ADMIN
            if (req.context?.user?.role === 'SUPER_ADMIN') {
                return next();
            }

            const id = req.context?.sessionId || req.validated?.body?.email || req.ip;
            const key = `rate:${prefix}:${id}`;

            const limit = rate_limit.LIMIT;
            const window = rate_limit.WINDOW_SEC;

            const count = await cacheService.increment(key, window);

            res.set("X-RateLimiting-Remaining", String(Math.max(0, limit - count)));

            if (count > limit) {
                res.status(429).json({ error: "Too Many Requests" });
                return;
            }
            next();

        } catch (err: any) {
            console.error("[RateLimiter]", err.message);
            next();
        }
    }
}