import { createHash, randomBytes } from "node:crypto";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import {
  EmailTokenPurpose,
  type Prisma,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { externalUrl } from "@/lib/site";

// Single-use secrets sent by email — password reset links and email
// verification links. One module because the two differ only in how long they
// live, where they point, and what redeeming them does; everything else (the
// entropy, the hashing, the atomic redeem) is the same problem twice.
//
// The token that travels in the email is 256 bits of CSPRNG output; the
// database only ever sees its SHA-256. That asymmetry is the point: a dump of
// EmailToken hands an attacker hashes, and there is no cheaper way back to a
// usable link than brute-forcing 2^256. Plain SHA-256 (not bcrypt) is the right
// tool here precisely *because* the input is already high-entropy — the
// slow-hash argument only applies to human-chosen secrets.
//
// Nothing below is exported. Callers get the two flow objects at the bottom
// instead, so a purpose is named once, next to the URL it belongs with, rather
// than passed as an argument that a call site could get wrong — mixing them up
// would let a confirmation link (which anyone gets by signing up) reset a
// password, and that mistake would compile.

/** Opaque, URL-safe token for the link. Never stored as-is. */
export function generateEmailToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The form stored in the database. Deterministic, so lookups stay indexed. */
export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a fresh token, replacing whatever the user had for this purpose.
 *
 * One upsert, because `@@unique([userId, purpose])` makes "at most one live
 * link per purpose" the database's rule. The delete-then-insert this replaces
 * needed a transaction and a lock on the User row to be safe, and that lock was
 * the thing that put issuing and redeeming in opposite lock orders — a deadlock
 * between a resend in one tab and a submit in another. Issuing no longer touches
 * User at all, so the cycle cannot form.
 */
async function issueToken(
  userId: string,
  purpose: EmailTokenPurpose,
  ttlSeconds: number,
): Promise<string> {
  const token = generateEmailToken();
  const tokenHash = hashEmailToken(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await prisma.emailToken.upsert({
    where: { userId_purpose: { userId, purpose } },
    create: { userId, purpose, tokenHash, expiresAt },
    update: { tokenHash, expiresAt },
  });

  return token;
}

/**
 * Is this token currently good? Used to decide whether a page renders its form
 * or a "link expired" state. Read-only — it does not consume.
 *
 * Expiry is compared with `now()` in SQL rather than `Date.now()` in JS: the
 * column is timestamptz precisely so the answer does not depend on whose clock
 * is asked, and on a multi-instance deploy that is not a hypothetical.
 */
async function tokenIsValid(
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
 * Redeem a token exactly once and apply `data` to its owner, or return null if
 * the token is unknown, expired, already spent, or meant for something else.
 *
 * The DELETE does every job at once: the WHERE is the expiry and purpose check,
 * the delete itself is the single-use gate, and RETURNING hands back the owner.
 * Two concurrent submissions of one link cannot both match — the loser deletes
 * nothing — and there is no read-then-write window between them.
 *
 * Spending the token and writing the result share a transaction so that a
 * failure on the write puts the link back, rather than leaving a user with an
 * unchanged password and a link they have already used.
 */
async function redeemToken(
  token: string,
  purpose: EmailTokenPurpose,
  data: Prisma.UserUpdateInput,
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ userId: string }[]>`
      DELETE FROM "EmailToken"
      WHERE "tokenHash" = ${hashEmailToken(token)}
        AND "purpose" = ${purpose}::"EmailTokenPurpose"
        AND "expiresAt" > now()
      RETURNING "userId"
    `;
    const userId = rows[0]?.userId;
    if (!userId) return null;

    await tx.user.update({ where: { id: userId }, data });
    return userId;
  });
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

type Recipient = { id: string; email: string };

/**
 * One flow: a purpose, how long its links last, where they point, and how they
 * are worded — bound together so no call site can pair them up wrongly.
 */
export type EmailLink = {
  readonly ttlSeconds: number;
  /** Issue a link for `user` and mail it. */
  issueAndSend(user: Recipient): Promise<void>;
  /** Read-only check, for a page deciding what to render. */
  isValid(token: string): Promise<boolean>;
  /** Spend the token and apply `data` to its owner. Returns the owner's id. */
  redeem(token: string, data: Prisma.UserUpdateInput): Promise<string | null>;
};

function defineEmailLink(spec: {
  purpose: EmailTokenPurpose;
  ttlSeconds: number;
  /** The page that redeems it. Same object as the purpose, so they agree. */
  path: string;
  send: (to: string, url: string, ttlSeconds: number) => Promise<void>;
}): EmailLink {
  const { purpose, ttlSeconds, path, send } = spec;
  return {
    ttlSeconds,
    async issueAndSend(user) {
      const token = await issueToken(user.id, purpose, ttlSeconds);
      await send(
        user.email,
        externalUrl(`${path}?token=${encodeURIComponent(token)}`),
        ttlSeconds,
      );
    },
    isValid: (token) => tokenIsValid(token, purpose),
    redeem: (token, data) => redeemToken(token, purpose, data),
  };
}

/**
 * A reset link is short-lived because it is a live credential for an account
 * someone is, by definition, having trouble getting into.
 */
export const PASSWORD_RESET_LINK = defineEmailLink({
  purpose: EmailTokenPurpose.PASSWORD_RESET,
  ttlSeconds: 60 * 60,
  path: "/reset-password",
  send: sendPasswordResetEmail,
});

/**
 * A confirmation link is not a way in — it only asserts an address — and people
 * check personal mail on their own schedule, so an hour would mostly generate
 * "expired" pages and resends.
 */
export const EMAIL_VERIFICATION_LINK = defineEmailLink({
  purpose: EmailTokenPurpose.EMAIL_VERIFICATION,
  ttlSeconds: 24 * 60 * 60,
  path: "/verify-email",
  send: sendVerificationEmail,
});
