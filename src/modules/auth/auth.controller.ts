import type { NextFunction, Request, Response } from 'express';
import AuthService from './auth.service.js';
import {
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_EXPIRY_MS,
  COOKIE_OPTIONS
} from '../../constants/auth.constants.js';

class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.validated.body);
      res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.validated.body);

      // Set access token in http-only cookie
      res.cookie('accessToken', result.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_TOKEN_EXPIRY_MS
      });

      // Set refresh token in http-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_EXPIRY_MS
      });

      res.status(200).json({
        message: result.message,
        user: result.user,
      });
    } catch (error: any) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      await this.authService.logout(userId, req.cookies.refreshToken, req.context.sessionId);

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.status(200).json({ message: 'Logout successful' });
    } catch (error: any) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.forgotPassword(req.validated.body);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.resetPassword(req.validated.body);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.verifyEmail(req.validated.query);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.refreshToken(req.cookies.refreshToken);

      // Set new access token in http-only cookie
      res.cookie('accessToken', result.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_TOKEN_EXPIRY_MS
      });

      // Set new refresh token in http-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_EXPIRY_MS
      });

      res.status(200).json({
        message: 'Token refreshed successfully',
        user: result.user,
      });
    } catch (error: any) {
      next(error);
    }
  };

  googleAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.validated.body;
      const result = await this.authService.googleAuth(token);

      res.cookie('accessToken', result.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_TOKEN_EXPIRY_MS
      });

      res.cookie('refreshToken', result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_EXPIRY_MS
      });

      res.status(200).json({
        message: result.message,
        user: result.user,
      });
    } catch (error: any) {
      next(error);
    }
  };
}

export default AuthController;
