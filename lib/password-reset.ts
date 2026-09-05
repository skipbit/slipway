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
 * Is this token currently good? Used to decide whether /reset-password renders
 * the form or the "link expired" state. Read-only — it does not consume.
 */
export async function isPasswordResetTokenValid(
  token: string,
): Promise<boolean> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  return Boolean(row && row.expiresAt.getTime() >= Date.now());
}

/**
 * Redeem a token exactly once and return the user it belongs to (null if it is
 * unknown, expired, or already spent).
 *
 * The `deleteMany` is the atomic gate: a single DELETE statement, so of two
 * concurrent submissions of the same link exactly one sees `count === 1` and
 * the loser is turned away even though its earlier read found the row.
 */
export async function consumePasswordResetToken(
  token: string,
): Promise<string | null> {
  const tokenHash = hashResetToken(token);

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;

  const { count } = await prisma.passwordResetToken.deleteMany({
    where: { tokenHash },
  });
  if (count !== 1) return null;

  return row.userId;
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
