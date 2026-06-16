import type { NextFunction, Request, Response } from 'express';
import UserService from './user.service.js';
import type { UserIdParams } from './user.validation.js';

class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // POST /users - Create new user
  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.createUser(req.context.user, req.validated.body);
      res.status(201).json({ message: 'User created successfully', user });
    } catch (error: any) {
      next(error);
    }
  };

  // GET /users/me - Get current user profile
  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const user = await this.userService.getProfile(userId);
      res.status(200).json({ user });
    } catch (error: any) {
      next(error);
    }
  };

  // PUT /users/me - Update own profile
  updateOwnProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const user = await this.userService.updateOwnProfile(userId, req.validated.body);
      res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (error: any) {
      next(error);
    }
  };

  // PATCH /users/me/change-password - Change own password
  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const { oldPassword, newPassword } = req.validated.body;
      const result = await this.userService.changePassword(userId, oldPassword, newPassword);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  };

  // DELETE /users/me - Deactivate own account
  deactivateAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      await this.userService.deactivateAccount(userId);
      res.status(200).json({ message: 'Account deactivated successfully' });
    } catch (error: any) {
      next(error);
    }
  };

  // GET /users - List users
  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = { ...req.validated.query };
      
      // If not Super Admin, force search within their own institution
      if (req.context.user.role !== 'SUPER_ADMIN') {
        filters.institution_id = req.context.user.institution_id;
      }

      console.log('List users filters (processed):', filters);
      const result = await this.userService.listUsers(filters);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  };

  // GET /users/:id - Get user by ID
  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.validated.params as UserIdParams;
      const user = await this.userService.getUserById(params.id);
      res.status(200).json({ user });
    } catch (error: any) {
      next(error);
    }
  };

  // PATCH /users/:id/role - Update user role
  updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.validated.params as UserIdParams;
      const user = await this.userService.updateUserRole(req.context.user, params.id, req.validated.body.role);
      res.status(200).json({ message: 'User role updated successfully', user });
    } catch (error: any) {
      next(error);
    }
  };

  // PATCH /users/:id/status - Suspend/Reactivate user
  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.validated.params as UserIdParams;
      const active = req.validated.body.active;
      const user = await this.userService.updateUserStatus(req.context.user, params.id, active);
      res.status(200).json({
        message: active ? 'User reactivated successfully' : 'User suspended successfully',
        user
      });
    } catch (error: any) {
      next(error);
    }
  };

  // DELETE /users/:id - Restore user
  restoreUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.validated.params as UserIdParams;
      await this.userService.restoreUser(req.context.user, params.id);
      res.status(200).json({ message: 'User restored successfully' });
    } catch (error: any) {
      next(error);
    }
  };
}

export default UserController;
