import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Password reset tokens.
//
// The token that travels in the email is 256 bits of CSPRNG output; the
// database only ever sees its SHA-256. That asymmetry is the point: a dump of
// PasswordResetToken hands an attacker hashes, and there is no cheaper way back
// to a usable link than brute-forcing 2^256. Plain SHA-256 (not bcrypt) is the
// right tool here precisely *because* the input is already high-entropy — the
// slow-hash argument only applies to human-chosen secrets.

/** How long a reset link stays valid. */
export const RESET_TOKEN_TTL_SECONDS = 60 * 60;

/** Opaque, URL-safe token for the reset link. Never stored as-is. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The form stored in the database. Deterministic, so lookups stay indexed. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a fresh link for `userId` and return the plaintext token to email.
 *
 * Any previous tokens for the user are dropped first, so requesting a new link
 * silently retires the old one — a user who requests twice cannot be confused
 * by which of two live links to click.
 */
export async function createPasswordResetToken(
  userId: string,
): Promise<string> {
  const token = generateResetToken();

  // One transaction, so the retire and the issue are all-or-nothing. Run apart,
  // a failure between them would leave the user with no link at all while the
  // caller still reports success, and two concurrent requests could interleave
  // into two live tokens.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000),
      },
    }),
  ]);

  return token;
}

/**
 * Anything that can run a raw query — the client, or a transaction handle.
 * Lets the caller pull the redeem into the same transaction as the password
 * write, so a failure there puts the token back.
 */
type RawClient = { $queryRaw: typeof prisma.$queryRaw };

/**
 * Is this token currently good? Used to decide whether /reset-password renders
 * the form or the "link expired" state. Read-only — it does not consume.
 *
 * Expiry is compared with `now()` in SQL rather than `Date.now()` in JS: the
 * column is timestamptz precisely so the answer does not depend on whose clock
 * is asked, and on a multi-instance deploy that is not a hypothetical.
 */
export async function isPasswordResetTokenValid(
  token: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ valid: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "PasswordResetToken"
      WHERE "tokenHash" = ${hashResetToken(token)}
        AND "expiresAt" > now()
    ) AS valid
  `;
  return rows[0]?.valid ?? false;
}

/**
 * Redeem a token exactly once and return the user it belongs to (null if it is
 * unknown, expired, or already spent).
 *
 * One statement does all three jobs: the WHERE is the expiry check, the DELETE
 * is the single-use gate, and RETURNING hands back the owner. Two concurrent
 * submissions of the same link cannot both match — the loser deletes nothing
 * and gets an empty result — and there is no read-then-write window to lose.
 */
export async function consumePasswordResetToken(
  token: string,
  client: RawClient = prisma,
): Promise<string | null> {
  const rows = await client.$queryRaw<{ userId: string }[]>`
    DELETE FROM "PasswordResetToken"
    WHERE "tokenHash" = ${hashResetToken(token)}
      AND "expiresAt" > now()
    RETURNING "userId"
  `;
  return rows[0]?.userId ?? null;
}

/**
 * Drop links nobody clicked before they expired. Successful resets clean up
 * after themselves, so this only reclaims abandoned rows — wire it into the
 * same periodic job as cleanupExpiredRateLimits(). The `@@index([expiresAt])`
 * keeps the sweep cheap. Returns the row count removed.
 */
export async function cleanupExpiredPasswordResetTokens(): Promise<number> {
  return prisma.passwordResetToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .then((r) => r.count);
}
