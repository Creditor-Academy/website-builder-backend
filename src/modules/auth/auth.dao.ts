import type { Prisma, UserRole } from '@prisma/client';
import prismaClient from '../../config/prisma.js';



class AuthDao {

  // User operations

  async findUserByEmail(email: string, { include_password_hash } = { include_password_hash: false }) {

    return await prismaClient.user.findUnique({

      where: { email },
      include: { institution: true },
      omit: {

        password_hash: !include_password_hash

      }

    });

  }



  async findUserById(id: string) {

    return await prismaClient.user.findUnique({

      where: { id },
      include: { institution: true },
      omit: { password_hash: true }

    });

  }



  async createUser(userData: {
    name: string;
    email: string;
    password_hash?: string;
    auth_provider?: string;
    isVerified?: boolean;
    isActive?: boolean;
    role?: UserRole;
    institution_id?: string | null;
  }) {

    const createData: Prisma.UserCreateInput = {
      name: userData.name,
      email: userData.email,
      auth_provider: userData.auth_provider || 'email',
      ...(userData.password_hash !== undefined ? { password_hash: userData.password_hash } : {}),
      ...(userData.isVerified !== undefined ? { isVerified: userData.isVerified } : {}),
      ...(userData.isActive !== undefined ? { isActive: userData.isActive } : {}),
      ...(userData.role !== undefined ? { role: userData.role } : {}),
      ...(userData.institution_id ? { institution: { connect: { id: userData.institution_id } } } : {}),
    };

    return await prismaClient.user.create({

      data: createData,
      include: { institution: true },
      omit: { password_hash: true }

    });

  }



  async updateUser(userId: string, userData: any) {

    return await prismaClient.user.update({

      where: { id: userId },

      data: userData,

      omit: { password_hash: true }

    });

  }



  async updateUserPassword(userId: string, password_hash: string) {

    return await prismaClient.user.update({

      where: { id: userId },

      data: {

        password_hash,

        lastPasswordChangeAt: new Date()

      },

      omit: { password_hash: true }

    })

  }



  // Email verification token operations

  async createEmailVerificationToken(tokenData: { userId: string; token_hash: string; expiresAt: Date }) {

    return await prismaClient.emailVerificationToken.create({

      data: tokenData,

    });

  }



  async findEmailVerificationToken(tokenHash: string) {

    // find a valid (non-expired) verification token by its hash

    return await prismaClient.emailVerificationToken.findFirst({

      include: {

        user: { omit: { password_hash: true } }

      },

      where: {

        token_hash: tokenHash,

        expiresAt: { gt: new Date() }, // Only find valid (non-expired) tokens

      }

    });

  }



  // Clean up expired email verification tokens

  async deleteExpiredEmailVerificationTokens() {

    return await prismaClient.emailVerificationToken.deleteMany({

      where: {

        expiresAt: { lt: new Date() }

      },

    });

  }



  // Password reset token operations

  async createPasswordResetToken(tokenData: { userId: string; token_hash: string; expiresAt: Date }) {

    return await prismaClient.passwordResetToken.create({

      data: tokenData,

    });

  }



  async findPasswordResetToken(tokenHash: string) {

    // find a valid (non-expired, non-used) reset token by its hash

    return await prismaClient.passwordResetToken.findFirst({

      include: {

        user: { omit: { password_hash: true } }

      },

      where: {

        token_hash: tokenHash,

        expiresAt: { gt: new Date() }, // Only find valid (non-expired) tokens

        isUsed: false, // Only find tokens that haven't been used yet

      }

    });

  }



  async usePasswordResetToken(tokenId: string) {

    return await prismaClient.passwordResetToken.update({

      where: { id: tokenId },

      data: { isUsed: true },

    });

  }



  // Clean up expired password reset tokens

  async deleteExpiredPasswordResetTokens() {

    return await prismaClient.passwordResetToken.deleteMany({

      where: {

        expiresAt: { lt: new Date() },

      },

    });

  }



  // Refresh token operations

  async createRefreshToken(tokenData: { userId: string; token_hash: string; sessionId: string; expiresAt: Date }) {

    return await prismaClient.refreshToken.create({

      data: tokenData,

    });

  }



  async findRefreshToken(tokenHash: string) {

    return await prismaClient.refreshToken.findFirst({

      include: {

        user: { omit: { password_hash: true } }

      },

      where: {

        token_hash: tokenHash,

        expiresAt: { gt: new Date() }, // Only find valid (non-expired) tokens

      }

    });

  }



  async revokeRefreshToken(tokenId: string) {

    return await prismaClient.refreshToken.update({

      where: { id: tokenId },

      data: { isRevoked: true },

    });

  }



  async revokeAllRefreshTokens(userId: string) {

    return await prismaClient.refreshToken.updateMany({

      where: { userId },

      data: { isRevoked: true },

    });

  }



  // Clean up expired refresh tokens

  async deleteExpiredRefreshTokens() {

    return await prismaClient.refreshToken.deleteMany({

      where: {

        expiresAt: { lt: new Date() },

      },

    });

  }

}



export default AuthDao;

