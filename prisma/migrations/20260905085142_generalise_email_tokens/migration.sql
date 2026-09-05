-- Hand-written: Prisma cannot infer a rename from a schema diff, so it proposed
-- DROP + CREATE. That would invalidate every password reset link already sitting
-- in someone's inbox at deploy time, for no reason — the table is gaining a
-- column, not changing shape. `prisma migrate diff --exit-code` (CI's
-- `migrations` job) proves the end state still matches schema.prisma.

-- CreateEnum
CREATE TYPE "EmailTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- RenameTable
ALTER TABLE "PasswordResetToken" RENAME TO "EmailToken";

-- Every row that existed before this migration was a password reset token. The
-- default backfills them and is then dropped, so new rows must say what they are.
ALTER TABLE "EmailToken" ADD COLUMN "purpose" "EmailTokenPurpose" NOT NULL DEFAULT 'PASSWORD_RESET';
ALTER TABLE "EmailToken" ALTER COLUMN "purpose" DROP DEFAULT;

-- RENAME TO moves the table but leaves its constraints and indexes under the
-- old names, which would then not match what Prisma expects to find.
ALTER TABLE "EmailToken" RENAME CONSTRAINT "PasswordResetToken_pkey" TO "EmailToken_pkey";
ALTER TABLE "EmailToken" RENAME CONSTRAINT "PasswordResetToken_userId_fkey" TO "EmailToken_userId_fkey";
ALTER INDEX "PasswordResetToken_tokenHash_key" RENAME TO "EmailToken_tokenHash_key";
ALTER INDEX "PasswordResetToken_expiresAt_idx" RENAME TO "EmailToken_expiresAt_idx";

-- The lookup is now "this user's tokens for this purpose".
DROP INDEX "PasswordResetToken_userId_idx";
CREATE INDEX "EmailToken_userId_purpose_idx" ON "EmailToken"("userId", "purpose");
