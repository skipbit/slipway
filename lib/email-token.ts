import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
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
// No purpose-taking function is exported. Callers get the two flow objects at
// the bottom instead, so a purpose is named once, next to the URL it belongs
// with, rather than passed as an argument that a call site could get wrong —
// mixing them up would let a confirmation link (which anyone gets by signing
// up) reset a password, and that mistake would compile.

/**
 * Longest string we will treat as a possible token.
 *
 * Ours are 43 characters of base64url. The bound lives here rather than only in
 * the zod schemas because the schemas guard the POST paths, and the GET on a
 * link-landing page hands a query parameter straight to `createHash` on an
 * unauthenticated route — the cap belongs where both paths pass through.
 */
const MAX_TOKEN_LENGTH = 200;

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
  if (token.length > MAX_TOKEN_LENGTH) return false;

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
 *
 * Redeeming ANY link proves control of the address it was sent to, so this also
 * confirms the address — which is why the password reset flow does not have to
 * ask for it separately. It promotes rather than overwrites: an existing
 * timestamp records when the address was FIRST proved, and a product reading
 * that column as "verified since" should not have it moved by an unrelated
 * password reset years later.
 */
async function redeemToken(
  token: string,
  purpose: EmailTokenPurpose,
  data?: Prisma.UserUpdateInput,
): Promise<string | null> {
  if (token.length > MAX_TOKEN_LENGTH) return null;

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

    if (data) await tx.user.update({ where: { id: userId }, data });
    await tx.user.updateMany({
      where: { id: userId, emailVerified: null },
      data: { emailVerified: new Date() },
    });
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
type EmailLink = {
  readonly ttlSeconds: number;
  /** Issue a link for `user` and mail it. */
  issueAndSend(user: Recipient): Promise<void>;
  /** Read-only check, for a page deciding what to render. */
  isValid(token: string): Promise<boolean>;
  /**
   * Spend the token, optionally applying `data` to its owner, and confirm the
   * address either way. Returns the owner's id.
   */
  redeem(token: string, data?: Prisma.UserUpdateInput): Promise<string | null>;
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
      // Mint on the response path, mail off it. The write is one upsert and its
      // ORDER matters — deferring it too would let a resend clicked seconds
      // later be overwritten by this one, leaving the link the user just asked
      // for dead and an older one live. The provider round trip is the slow
      // part (150-500ms, up to the 10s timeout) and nothing waits on its
      // result, so that is the half worth deferring.
      const token = await issueToken(user.id, purpose, ttlSeconds);
      const url = externalUrl(`${path}?token=${encodeURIComponent(token)}`);

      after(async () => {
        try {
          await send(user.email, url, ttlSeconds);
        } catch (err) {
          console.error(`[email-token] failed to send ${path} link`, err);
        }
      });
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
