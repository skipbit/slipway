-- "At most one live token per user per purpose" was an application rule kept by
-- a delete-then-insert inside a transaction. Making it the database's rule lets
-- issuing become a single upsert — and, less obviously, removes the only reason
-- issuing had to lock the User row, which is what made the lock order of
-- issuing and redeeming opposite in the first place.

-- The rule was not previously enforced, and the delete-then-insert it replaces
-- could interleave under READ COMMITTED, so make room for the constraint before
-- adding it. Normally deletes nothing; keeps the newest per (user, purpose).
DELETE FROM "EmailToken" a
USING "EmailToken" b
WHERE a."userId" = b."userId"
  AND a."purpose" = b."purpose"
  AND (a."createdAt", a."id") < (b."createdAt", b."id");

-- DropIndex
DROP INDEX "EmailToken_userId_purpose_idx";

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_userId_purpose_key" ON "EmailToken"("userId", "purpose");
