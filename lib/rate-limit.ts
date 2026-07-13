import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Postgres-backed fixed-window rate limiter. In-memory counters are useless
// on serverless/multi-instance deploys (each invocation may be a fresh
// process), so we lean on the database everyone already shares. The upsert is
// atomic — Postgres serializes ON CONFLICT updates per row — so concurrent
// attempts can't race past the limit.

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
 * Falls back to "unknown" (one shared bucket) rather than silently disabling
 * the limit when no header is present.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
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
    VALUES (${key}, 1, ${expiresAt})
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
