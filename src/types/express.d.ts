import type { Website } from "@prisma/client";
import "express";

declare global {
  namespace Express {
    interface Request {
      id: string;
      validated: {
        body?: any;
        query?: any;
        params?: any;
      };
      context: {
        user: AuthUser;
        sessionId: string;
        website?: Website;
      }
    }
  }
}

export { };