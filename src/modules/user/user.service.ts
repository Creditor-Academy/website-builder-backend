import { hashPassword, comparePassword } from '../../utils/password.util.js';
import cacheService from '../../services/cache.service.js';
import { generateAuthSessionKey } from '../../builders/redis-key.builder.js';
import { UserRole } from '@prisma/client';
import UserDao from './user.dao.js';
import AuthDao from '../auth/auth.dao.js';
import type { AuthUser } from '../../types/auth.types.js';
import type { ListUsersQueryInput, UpdateOwnProfileInput } from './user.validation.js';
import { NotFoundError, UnauthorizedError, UnprocessableEntityError } from '../../utils/error.utils.js';

class UserService {
  private userDao: UserDao;
  private authDao: AuthDao;

  constructor() {
    this.userDao = new UserDao();
    this.authDao = new AuthDao();
  }

  async createUser(currentUser: AuthUser, data: any) {
    const { name, email, password, role, institution_id } = data;

    // Check if user already exists
    const existingUser = await this.userDao.findUserByEmail(email);
    if (existingUser) {
      throw new UnprocessableEntityError('User with this email already exists');
    }

    // Role and Institution scoping
    let targetInstitutionId = institution_id || null;
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      // Non-super-admins can only create users in their own institution
      targetInstitutionId = currentUser.institution_id;
    }

    const password_hash = await hashPassword(password);

    return await this.userDao.createUser({
      name,
      email,
      password_hash,
      role: role || UserRole.USER,
      institution_id: targetInstitutionId,
      isVerified: true, // Admin-created users are pre-verified
      isActive: true
    } as any);
  }

  async getProfile(userId: string) {
    const user = await this.userDao.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async updateOwnProfile(userId: string, data: UpdateOwnProfileInput) {
    const user = await this.userDao.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return await this.userDao.updateUser(userId, data);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    // Get user with password_hash
    const userWithPassword = await this.userDao.findUserById(userId, { include_password_hash: true });
    if (!userWithPassword) {
      throw new NotFoundError('User not found');
    }
    if (!userWithPassword.password_hash) {
      throw new UnprocessableEntityError('This account does not have a password set');
    }

    // Verify old password by fetching with password
    const isPasswordValid = await comparePassword(oldPassword, userWithPassword.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const password_hash = await hashPassword(newPassword);

    // Update password
    await this.userDao.updateUser(userId, { password_hash });

    return { message: 'Password changed successfully' };
  }

  async deactivateAccount(userId: string) {
    const user = await this.userDao.findUserById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundError('User not found');
    }
    if (user.role === UserRole.ADMIN) {
      throw new UnprocessableEntityError('Admin accounts cannot be deactivated');
    }
    await this.userDao.updateUser(userId, { isActive: false, deleted_at: new Date() });

    // Revoke all refresh tokens and sessions
    await this.authDao.revokeAllRefreshTokens(userId);

    const sessionKeyPattern = generateAuthSessionKey(userId, '*');
    await cacheService.clear(sessionKeyPattern);
  }

  async listUsers(filters: ListUsersQueryInput) {
    return await this.userDao.listUsers(filters);
  }

  async getUserById(userId: string) {
    const user = await this.userDao.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async updateUserRole(currentUser: AuthUser, userId: string, newRole: string) {
    const targetUser = await this.userDao.findUserById(userId);
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    if (currentUser.id === userId) {
      throw new UnprocessableEntityError('You cannot change your own role');
    }

    if (targetUser.role === newRole) {
      throw new UnprocessableEntityError('User already has this role');
    }

    // Admin can change anyone's role to/from ADMIN
    return await this.userDao.updateUser(userId, { role: newRole });
  }

  async updateUserStatus(currentUser: AuthUser, userId: string, active: boolean) {
    const user = await this.userDao.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.id === currentUser.id) {
      throw new UnprocessableEntityError('You cannot update your own status');
    }

    if (user.isActive === active) {
      throw new UnprocessableEntityError('User status is already set to the requested value');
    }

    let updatedUser;

    if (active) {
      // If user is being reactivated, clear deleted_at timestamp
      updatedUser = await this.userDao.updateUser(userId, { isActive: true, deleted_at: null });
    }
    else {
      // If user is being suspended, set deleted_at timestamp and deactivate account
      updatedUser = await this.userDao.updateUser(userId, { isActive: false, deleted_at: new Date() });

      // If user is being suspended, revoke all their tokens and sessions
      await this.authDao.revokeAllRefreshTokens(userId);

      const sessionKeyPattern = generateAuthSessionKey(userId, '*');
      await cacheService.clear(sessionKeyPattern);
    }

    return updatedUser;
  }

  async restoreUser(currentUser: AuthUser, userId: string) {
    const user = await this.userDao.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (user.isActive) {
      throw new UnprocessableEntityError('User is already active');
    }

    // Cannot restore yourself
    if (currentUser.id === userId) {
      throw new UnprocessableEntityError('You cannot restore yourself');
    }

    return await this.userDao.updateUser(userId, { isActive: true, deleted_at: null });
  }

  async cleanupDeletedUsers() {
    // Hard delete users that were soft deleted more than 30 days ago
    await this.userDao.cleanupDeletedUsers();
  }
}

export default UserService;
