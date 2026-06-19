import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';
import type { HttpError } from 'http-errors';

import jwt from 'jsonwebtoken';

const csrfConfig = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || 'a-very-secure-secret-key-that-should-be-in-env',
    cookieName: process.env.NODE_ENV === 'production' ? '__Host-buildora.x-csrf-token' : 'x-csrf-token',
    cookieOptions: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string,
    getSessionIdentifier: (req: Request) => 'session',
});

export const invalidCsrfTokenError: HttpError = csrfConfig.invalidCsrfTokenError;
export const generateToken = csrfConfig.generateCsrfToken;
export const doubleCsrfProtection = csrfConfig.doubleCsrfProtection;
