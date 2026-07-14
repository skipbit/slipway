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
// a real Postgres or Next.js request context.
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

describe("cleanupExpiredRateLimits", () => {
  it("returns the number of rows deleted", async () => {
    deleteManyMock.mockResolvedValue({ count: 5 });
    expect(await cleanupExpiredRateLimits()).toBe(5);
    expect(deleteManyMock).toHaveBeenCalledOnce();
  });
});
