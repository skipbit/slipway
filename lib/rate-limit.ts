import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Postgres-backed fixed-window rate limiter. In-memory counters are useless
// on serverless/multi-instance deploys (each invocation may be a fresh
// process), so we lean on the database everyone already shares. The upsert is
// atomic — Postgres serializes ON CONFLICT updates per row — so concurrent
// attempts can't race past the limit.

/** A bucket's allowance. Passed around as one value so call sites can't
 *  swap the two numbers. */
export type RateLimitConfig = {
  max: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  /** False once the caller has exceeded `limit` within the window. */
  success: boolean;
  /** Attempts left before blocking (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets (0 when not blocked). */
  retryAfterSeconds: number;
};

/**
 * Best-effort client IP from proxy headers.
 *
 * TRUST BOUNDARY: these headers are only meaningful when a proxy you control
 * sets them from the real socket address and strips any inbound copies. A
 * directly-exposed origin lets a caller spoof them and mint a fresh bucket per
 * request — so this limiter assumes it sits behind a trusted proxy (nginx
 * `X-Real-IP $remote_addr`, Vercel, etc.). We prefer `x-real-ip` because it is
 * a single proxy-set value; `x-forwarded-for` is a client-prependable list
 * whose leftmost token is attacker-controlled, so it is only a fallback.
 *
 * THE OTHER FAILURE, measured: Next's own server fills `x-forwarded-for` in
 * from the socket when the client sends none, so this rarely returns null in
 * practice — it returns whatever the last hop was. Publish port 3000 straight
 * out of Docker (which is what `docker-compose.prod.yml` does) and that hop can
 * be the Docker gateway, identical for every visitor on the internet. The
 * headers then look present and trustworthy while every caller shares one
 * bucket. Nothing in the request can distinguish that from a real proxy, so
 * per-IP limits must be chosen to stay survivable if it happens — see the
 * limits in app/(auth)/actions.ts.
 *
 * Returns null when no header identifies the caller, and callers skip per-IP
 * throttling entirely in that case. The tempting alternative — a shared
 * "unknown" bucket — is worse than no limit at all: on a deploy with no proxy
 * (which is what `docker compose -f docker-compose.prod.yml up` gives you,
 * port 3000 published straight out) EVERY visitor lands in it, so the sixth
 * password reset requested by anyone, anywhere, in an hour locks the feature
 * for the whole install. That is a self-inflicted outage dressed as a security
 * control, and it hits hardest on the one flow a locked-out user has no way
 * around. The per-address bucket still applies, so abuse of any single inbox
 * is still capped.
 *
 * The value is returned whole — bounding it for storage is rateLimit()'s job.
 */
let warnedAboutUnidentifiableClients = false;

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();

  if (!warnedAboutUnidentifiableClients) {
    warnedAboutUnidentifiableClients = true;
    console.warn(
      "[rate-limit] No x-real-ip or x-forwarded-for header on an incoming " +
        "request — per-IP throttling is off. Put the app behind a proxy that " +
        "sets x-real-ip from the real socket address; see the trust-boundary " +
        "note in lib/rate-limit.ts.",
    );
  }
  return null;
}

/**
 * Keep a bucket key inside what a btree index row can hold.
 *
 * `RateLimit.key` is the table's PRIMARY KEY, and callers build keys by
 * concatenating whatever they are throttling on — an IP from a client-supplied
 * header, an address typed into a public form. Unbounded, Postgres rejects the
 * INSERT with `index row size ... exceeds btree version 4 maximum 2704` and an
 * unauthenticated route throws. This bound lives here, next to the table that
 * imposes it, so it covers every caller and every key source added later; two
 * separate producers have already had to learn it the hard way.
 *
 * Long keys keep their prefix and hash the rest, so buckets stay identifiable
 * in the table without a length limit leaking into the callers' contracts.
 */
const MAX_KEY_LENGTH = 200;

/**
 * Hash a value that should not sit in the table in the clear.
 *
 * `RateLimit` rows outlive their window (nothing calls
 * cleanupExpiredRateLimits yet), so a bucket keyed on an address typed into a
 * public form would otherwise accumulate into a permanent list of real and
 * guessed email addresses. The bucket works the same on a digest.
 */
export function opaqueKeyPart(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function bucketKey(key: string): string {
  if (key.length <= MAX_KEY_LENGTH) return key;
  const colon = key.indexOf(":");
  const prefix = colon === -1 ? "" : key.slice(0, colon + 1);
  return `${prefix}h:${createHash("sha256").update(key).digest("base64url")}`;
}

/**
 * Count one hit against `key` and report whether the caller is now over the
 * limit. `limit` attempts are allowed per rolling `windowSeconds`; the window
 * resets in place the first time a hit lands after it has expired.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const expiresAt = new Date(Date.now() + windowSeconds * 1000);

  const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${bucketKey(key)}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."expiresAt" < now() THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "expiresAt" = CASE
        WHEN "RateLimit"."expiresAt" < now() THEN ${expiresAt}
        ELSE "RateLimit"."expiresAt"
      END
    RETURNING "count", "expiresAt"
  `;

  const row = rows[0]!;
  const count = Number(row.count);
  const success = count <= limit;

  return {
    success,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: success
      ? 0
      : Math.max(0, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000)),
  };
}

/**
 * Count one hit against `key` and return the sentence to show the caller, or
 * null to carry on.
 *
 * Lives here rather than at each entry point because the arithmetic and the
 * wording had already been copied once and drifted — "attempts" in one place,
 * "requests" in the other, with two copies of the same pluralisation. `noun` is
 * the only part worth varying.
 */
export async function throttleMessage(
  key: string,
  { max, windowSeconds }: RateLimitConfig,
  noun = "attempts",
): Promise<string | null> {
  const limit = await rateLimit(key, max, windowSeconds);
  if (limit.success) return null;

  const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
  return `Too many ${noun}. Try again in about ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

/**
 * Delete buckets whose window has elapsed. Rows are reset in place when the
 * same key returns, so distinct callers otherwise accumulate forever — wire
 * this into a periodic job (cron route / scheduled task) to reclaim them. The
 * `@@index([expiresAt])` on RateLimit keeps the sweep cheap. Returns the row
 * count removed.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  return prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .then((r) => r.count);
}
