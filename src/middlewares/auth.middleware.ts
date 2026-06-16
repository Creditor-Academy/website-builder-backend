import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util.js';
import cacheService from '../services/cache.service.js';
import { generateAuthSessionKey } from '../builders/redis-key.builder.js';
import type { AuthUser, JWTPayload } from '../types/auth.types.js';

/**
 * Authentication middleware
 * Verifies access token from cookies and attaches user to request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get access token from cookies
    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized. Please login to continue' });
    }

    // Verify token
    let decoded: JWTPayload;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized. Please login to continue' });
    }

    // Fetch user profile from database
    const sessionId = decoded.sessionId;
    const sessionKey = generateAuthSessionKey(decoded.userId, sessionId);
    const sessionData = await cacheService.get(sessionKey);

    if (!sessionData) {
      return res.status(401).json({ error: 'Session expired. Please login again' });
    }

    const user = {
      id: decoded.userId,
      role: decoded.role,
      refreshTokenId: decoded.refreshTokenId,
      institution_id: decoded.institution_id
    };

    // Note: email verification is tracked in session but not enforced as a blocker.
    // Uncomment the check below to require verified email for all actions.
    // if (sessionData.isVerified === false) {
    //   return res.status(403).json({ error: 'Please verify your email before continuing' });
    // }

    // Attach user to request context
    req.context = {
      user: user as AuthUser,
      sessionId: sessionId as string
    }

    next();

  } catch (error: any) {
    console.error('Authentication error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Role-based authorization middleware
 * Checks if the authenticated user has the required role(s)
 */
export const authorize = (roles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.context || !req.context.user) {
      return res.status(401).json({ error: 'Unauthorized. Please login to continue' });
    }

    // SUPER_ADMIN has access to everything
    if (req.context.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!roles.includes(req.context.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource' });
    }

    next();
  };
};