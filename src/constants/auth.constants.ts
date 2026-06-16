import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const TOKEN_TYPES = {
  ACCESS: 'ACCESS',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
};

export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '15d',
  EMAIL_VERIFICATION: '24h',
  PASSWORD_RESET: '1h',
};

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
export const REFRESH_TOKEN_EXPIRY_MS = 15 * 24 * 60 * 60 * 1000; // 15 days in milliseconds
export const AUTH_REDIS_EXPIRY_SECONDS = 15 * 60; // 15 minutes in seconds

export const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1;
export const EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

export const LOGIN_LIMIT = {
  LIMIT: 10,
  WINDOW_SEC: 10 * 60 // 10min
}

export const FORGOT_PW_LIMIT = {
  LIMIT: 5,
  WINDOW_SEC: 10 * 60 // 10min
}

export const REFRESH_LIMIT = {
  LIMIT: 10,
  WINDOW_SEC: 60 // 1min
}