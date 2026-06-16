import AuthService from '../modules/auth/auth.service.js';
import UserService from '../modules/user/user.service.js';

class CleanupService {
  private authService: AuthService;
  private userService: UserService;

  constructor() {
    this.authService = new AuthService();
    this.userService = new UserService();
  }

  // Method to clean up expired tokens
  // can be scheduled to run periodically using a scheduler (like node-cron)
  async cleanupExpiredTokens() {
    await this.authService.cleanupExpiredTokens();
  }

  // Method to clean up deleted user accounts
  async cleanupDeletedUsers() {
    await this.userService.cleanupDeletedUsers();
  }
}

export default CleanupService;