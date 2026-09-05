import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

// Mock the module boundaries so the limiter's JS logic can be exercised without
// a real Postgres or Next.js request context. NOTE: the fixed-window reset lives
// in the SQL `ON CONFLICT ... CASE WHEN expiresAt < now()` (see rate-limit.ts),
// which a mocked $queryRaw cannot exercise — that behaviour needs a Postgres-
// backed integration test. Here we only cover the JS success/remaining/retry
// arithmetic on hand-fed rows.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    rateLimit: { deleteMany: vi.fn() },
  },
}));

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  bucketKey,
  cleanupExpiredRateLimits,
  getClientIp,
  rateLimit,
} from "@/lib/rate-limit";

const headersMock = headers as unknown as Mock;
const queryRawMock = prisma.$queryRaw as unknown as Mock;
const deleteManyMock = prisma.rateLimit.deleteMany as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getClientIp", () => {
  it("prefers the single proxy-set x-real-ip header", async () => {
    headersMock.mockResolvedValue(
      new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }),
    );
    expect(await getClientIp()).toBe("203.0.113.7");
  });

  it("falls back to the leftmost x-forwarded-for token", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178",
      }),
    );
    expect(await getClientIp()).toBe("203.0.113.7");
  });

  it("returns 'unknown' when no proxy header is present", async () => {
    headersMock.mockResolvedValue(new Headers());
    expect(await getClientIp()).toBe("unknown");
  });

  it("returns the header whole — bounding it is rateLimit's job", async () => {
    const forged = "1".repeat(4000);
    headersMock.mockResolvedValue(new Headers({ "x-real-ip": forged }));
    expect(await getClientIp()).toBe(forged);
  });
});

describe("rateLimit", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function rowsWith(count: number, msFromNow: number) {
    queryRawMock.mockResolvedValue([
      { count, expiresAt: new Date(now.getTime() + msFromNow) },
    ]);
  }

  it("allows a caller under the limit and reports remaining attempts", async () => {
    rowsWith(3, 10 * 60_000);
    const result = await rateLimit("login:203.0.113.7", 10, 600);
    expect(result).toEqual({
      success: true,
      remaining: 7,
      retryAfterSeconds: 0,
    });
  });

  it("still allows the caller exactly at the limit", async () => {
    rowsWith(10, 10 * 60_000);
    const result = await rateLimit("login:203.0.113.7", 10, 600);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("blocks once over the limit and reports seconds until reset", async () => {
    rowsWith(11, 5 * 60_000);
    const result = await rateLimit("login:203.0.113.7", 10, 600);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(300);
  });

  it("treats a freshly reset window (count 1) as allowed", async () => {
    rowsWith(1, 10 * 60_000);
    const result = await rateLimit("signup:203.0.113.7", 5, 3600);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe("bucketKey", () => {
  // RateLimit.key is the table's PRIMARY KEY, so this bound is what keeps an
  // unbounded caller-built key (a forged X-Real-IP, an address typed into a
  // public form) from tripping `index row size ... exceeds btree version 4
  // maximum 2704` inside an unauthenticated route.
  it("leaves an ordinary key untouched", () => {
    expect(bucketKey("login:203.0.113.7")).toBe("login:203.0.113.7");
    expect(bucketKey("forgot:email:ada@example.com")).toBe(
      "forgot:email:ada@example.com",
    );
  });

  it("bounds a key that would not fit an index row", () => {
    const forged = `login:${"1".repeat(4000)}`;
    expect(bucketKey(forged).length).toBeLessThan(200);
  });

  it("keeps the prefix, so buckets stay identifiable", () => {
    expect(bucketKey(`login:${"1".repeat(4000)}`)).toMatch(/^login:h:/);
  });

  it("keeps distinct long keys in distinct buckets", () => {
    const a = bucketKey(`login:${"1".repeat(4000)}`);
    const b = bucketKey(`login:${"2".repeat(4000)}`);
    expect(a).not.toBe(b);
  });

  it("is stable, or a caller would get a fresh bucket per request", () => {
    const forged = `login:${"1".repeat(4000)}`;
    expect(bucketKey(forged)).toBe(bucketKey(forged));
  });

  it("copes with a key that has no prefix at all", () => {
    expect(bucketKey("x".repeat(4000))).toMatch(/^h:/);
  });
});

describe("rateLimit key handling", () => {
  it("stores the bounded key, not the raw one", async () => {
    queryRawMock.mockResolvedValue([
      { count: 1, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    const forged = `login:${"1".repeat(4000)}`;

    await rateLimit(forged, 10, 600);

    const values = queryRawMock.mock.calls[0]!.slice(1);
    expect(values).toContain(bucketKey(forged));
    expect(values).not.toContain(forged);
  });
});

describe("cleanupExpiredRateLimits", () => {
  it("returns the number of rows deleted", async () => {
    deleteManyMock.mockResolvedValue({ count: 5 });
    expect(await cleanupExpiredRateLimits()).toBe(5);
    expect(deleteManyMock).toHaveBeenCalledOnce();
  });
});
