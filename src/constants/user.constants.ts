import type { Prisma } from "@prisma/client";

export const SELECT_USER_FIELDS = {
    id: true,
    email: true,
    name: true,
    role: true,
    isVerified: true,
    isActive: true,
    deleted_at: true,
    created_at: true,
    lastLoginAt: true,
    institution_id: true,
    institution: {
        select: {
            id: true,
            name: true
        }
    }
} satisfies Prisma.UserSelect;

// 30 days in milliseconds
export const DELETED_USER_RETENTION_TIME = 30 * 24 * 60 * 60 * 1000;