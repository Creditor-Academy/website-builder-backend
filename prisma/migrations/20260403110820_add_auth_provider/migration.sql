-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_provider" TEXT NOT NULL DEFAULT 'email',
ALTER COLUMN "password_hash" DROP NOT NULL;
