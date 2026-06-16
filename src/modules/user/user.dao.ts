import type { Prisma } from '@prisma/client';
import prismaClient from '../../config/prisma.js';
import { SELECT_USER_FIELDS, DELETED_USER_RETENTION_TIME } from '../../constants/user.constants.js';
import type { ListUsersQueryInput } from './user.validation.js';

class UserDao {
  async findUserById(id: string, { include_password_hash } = { include_password_hash: false }) {
    return await prismaClient.user.findUnique({
      where: { id },
      omit: {
        password_hash: !include_password_hash
      }
    });
  }

  async findUserByEmail(email: string) {
    return await prismaClient.user.findUnique({
      where: { email },
      omit: { password_hash: true }
    });
  }

  async listUsers(filters: ListUsersQueryInput) {
    const {
      page = 1, limit = 10,
      role, isActive, isVerified,
      institution_id,
      search, created_after
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) where.role = role;
    if (institution_id) where.institution_id = institution_id;
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (typeof isVerified === 'boolean') where.isVerified = isVerified;

    if (created_after) {
      where.created_at = { gte: new Date(created_after) };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prismaClient.user.findMany({
        where,
        skip, take: limit,
        orderBy: { created_at: 'desc' },
        select: SELECT_USER_FIELDS
      }),
      prismaClient.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createUser(data: Prisma.UserCreateInput) {
    return await prismaClient.user.create({
      data,
      omit: { password_hash: true }
    });
  }

  async updateUser(userId: string, data: any) {
    return await prismaClient.user.update({
      data,
      where: { id: userId },
      omit: { password_hash: true }
    });
  }

  async deleteUser(userId: string) {
    return await prismaClient.user.delete({
      where: { id: userId },
    });
  }

  async cleanupDeletedUsers() {
    await prismaClient.user.deleteMany({
      where: {
        isActive: false,
        deleted_at: {
          lte: new Date(Date.now() - DELETED_USER_RETENTION_TIME)
        }
      }
    });
  }
}

export default UserDao;
