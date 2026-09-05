import { createHash, randomBytes } from "node:crypto";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { EmailTokenPurpose } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { externalUrl } from "@/lib/site";

// Single-use secrets sent by email — password reset links and email
// verification links. One module because the two differ only in how long they
// live and in what redeeming them does; everything below (the entropy, the
// hashing, the atomic redeem) is the same problem twice.
//
// The token that travels in the email is 256 bits of CSPRNG output; the
// database only ever sees its SHA-256. That asymmetry is the point: a dump of
// EmailToken hands an attacker hashes, and there is no cheaper way back to a
// usable link than brute-forcing 2^256. Plain SHA-256 (not bcrypt) is the right
// tool here precisely *because* the input is already high-entropy — the
// slow-hash argument only applies to human-chosen secrets.
//
// EVERY statement matches on `purpose` as well as the hash. Sharing one table
// is only safe because of that: without it a verification link — which a user
// gets simply for signing up — would be redeemable at /reset-password.

export { EmailTokenPurpose };

/**
 * How long each kind of link stays valid.
 *
 * A reset link is short-lived because it is a live credential for an account
 * that someone is, by definition, having trouble getting into. A verification
 * link is not a way in — it only confirms an address — and people check
 * personal mail on their own schedule, so an hour would mostly generate
 * "expired" pages and resends.
 */
export const EMAIL_TOKEN_TTL_SECONDS: Record<EmailTokenPurpose, number> = {
  PASSWORD_RESET: 60 * 60,
  EMAIL_VERIFICATION: 24 * 60 * 60,
};

/** Opaque, URL-safe token for the link. Never stored as-is. */
export function generateEmailToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The form stored in the database. Deterministic, so lookups stay indexed. */
export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a fresh link and return the plaintext token to email.
 *
 * The user's previous token OF THE SAME PURPOSE is dropped first, so asking for
 * a second reset link silently retires the first — nobody has to work out which
 * of two live links to click — while a pending verification is left alone.
 */
export async function issueEmailToken(
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<string> {
  const token = generateEmailToken();

  await prisma.$transaction(async (tx) => {
    // Serialise concurrent requests for this user: under READ COMMITTED the
    // deleteMany below cannot see a row another transaction has inserted but
    // not yet committed, so without this lock two requests would both retire
    // nothing and both insert, leaving two live links.
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await tx.emailToken.deleteMany({ where: { userId, purpose } });
    await tx.emailToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashEmailToken(token),
        expiresAt: new Date(
          Date.now() + EMAIL_TOKEN_TTL_SECONDS[purpose] * 1000,
        ),
      },
    });
  });

  return token;
}

/**
 * Anything that can run a raw query — the client, or a transaction handle.
 * Required, not defaulted: redeeming outside the transaction that acts on the
 * result is exactly the failure this design exists to prevent, so the signature
 * should not offer it.
 */
type RawClient = { $queryRaw: typeof prisma.$queryRaw };

/**
 * Is this token currently good? Used to decide whether a page renders its form
 * or a "link expired" state. Read-only — it does not consume.
 *
 * Expiry is compared with `now()` in SQL rather than `Date.now()` in JS: the
 * column is timestamptz precisely so the answer does not depend on whose clock
 * is asked, and on a multi-instance deploy that is not a hypothetical.
 */
export async function isEmailTokenValid(
  token: string,
  purpose: EmailTokenPurpose,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ valid: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "EmailToken"
      WHERE "tokenHash" = ${hashEmailToken(token)}
        AND "purpose" = ${purpose}::"EmailTokenPurpose"
        AND "expiresAt" > now()
    ) AS valid
  `;
  return rows[0]?.valid ?? false;
}

/**
 * Redeem a token exactly once and return the user it belongs to (null if it is
 * unknown, expired, already spent, or meant for something else).
 *
 * One statement does every job: the WHERE is the expiry and purpose check, the
 * DELETE is the single-use gate, and RETURNING hands back the owner. Two
 * concurrent submissions of the same link cannot both match — the loser deletes
 * nothing and gets an empty result — and there is no read-then-write window.
 */
export async function consumeEmailToken(
  token: string,
  purpose: EmailTokenPurpose,
  client: RawClient,
): Promise<string | null> {
  const rows = await client.$queryRaw<{ userId: string }[]>`
    DELETE FROM "EmailToken"
    WHERE "tokenHash" = ${hashEmailToken(token)}
      AND "purpose" = ${purpose}::"EmailTokenPurpose"
      AND "expiresAt" > now()
    RETURNING "userId"
  `;
  return rows[0]?.userId ?? null;
}

/**
 * Drop links nobody clicked before they expired. Redeemed tokens clean up after
 * themselves, so this only reclaims abandoned rows — wire it into the same
 * periodic job as cleanupExpiredRateLimits(). The `@@index([expiresAt])` keeps
 * the sweep cheap. Returns the row count removed.
 */
export async function cleanupExpiredEmailTokens(): Promise<number> {
  return prisma.emailToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .then((r) => r.count);
}

/**
 * Issue a link and mail it.
 *
 * Both senders live here, next to the tokens they mint, so the URL a message
 * points at and the purpose the page will redeem it under cannot drift apart —
 * they are two lines of the same function. The caller keeps the policy (who
 * gets one) and the error handling.
 */
type Recipient = { id: string; email: string };

export async function sendPasswordResetLink(user: Recipient): Promise<void> {
  const token = await issueEmailToken(
    user.id,
    EmailTokenPurpose.PASSWORD_RESET,
  );
  await sendPasswordResetEmail(
    user.email,
    externalUrl(`/reset-password?token=${encodeURIComponent(token)}`),
    EMAIL_TOKEN_TTL_SECONDS.PASSWORD_RESET,
  );
}

export async function sendEmailVerificationLink(
  user: Recipient,
): Promise<void> {
  const token = await issueEmailToken(
    user.id,
    EmailTokenPurpose.EMAIL_VERIFICATION,
  );
  await sendVerificationEmail(
    user.email,
    externalUrl(`/verify-email?token=${encodeURIComponent(token)}`),
    EMAIL_TOKEN_TTL_SECONDS.EMAIL_VERIFICATION,
  );
}
