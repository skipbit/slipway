import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

// Only the Prisma boundary is mocked — the crypto is real, because "the token
// we hand out is not the value we store" is exactly the property worth testing.
//
// NOTE: expiry now lives in SQL (`"expiresAt" > now()`), so a mocked $queryRaw
// cannot exercise it — same limitation as the fixed-window reset in
// rate-limit.test.ts. What is covered here is the hashing, the shape of the
// statements, and how their results are interpreted.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    // The real $transaction takes the already-built operations and commits them
    // together; awaiting them in order is a faithful enough stand-in to assert
    // what was sent and in which order.
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    passwordResetToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  RESET_TOKEN_TTL_SECONDS,
  cleanupExpiredPasswordResetTokens,
  consumePasswordResetToken,
  createPasswordResetToken,
  generateResetToken,
  hashResetToken,
  isPasswordResetTokenValid,
} from "@/lib/password-reset";

const queryRawMock = prisma.$queryRaw as unknown as Mock;
const transactionMock = prisma.$transaction as unknown as Mock;
const createMock = prisma.passwordResetToken.create as unknown as Mock;
const deleteManyMock = prisma.passwordResetToken.deleteMany as unknown as Mock;

const now = new Date("2026-07-14T00:00:00.000Z");

/** The interpolated values of a tagged-template $queryRaw call. */
function queryValues(call: unknown[]): unknown[] {
  return call.slice(1);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  createMock.mockResolvedValue({});
  deleteManyMock.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateResetToken", () => {
  it("emits 32 bytes of entropy", () => {
    expect(Buffer.from(generateResetToken(), "base64url")).toHaveLength(32);
  });

  it("stays inside the URL-safe alphabet so it survives a query string", () => {
    expect(generateResetToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateResetToken));
    expect(tokens.size).toBe(50);
  });
});

describe("hashResetToken", () => {
  it("is deterministic, so the unique index can find a row", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
  });

  it("produces a 64-char hex digest", () => {
    expect(hashResetToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("separates different tokens", () => {
    expect(hashResetToken("abc")).not.toBe(hashResetToken("abd"));
  });
});

describe("createPasswordResetToken", () => {
  it("stores the hash, never the token it returns", async () => {
    const token = await createPasswordResetToken("user_1");

    const { data } = createMock.mock.calls[0]![0];
    expect(data.tokenHash).toBe(hashResetToken(token));
    expect(data.tokenHash).not.toBe(token);
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it("retires the user's previous links first", async () => {
    await createPasswordResetToken("user_1");

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { userId: "user_1" },
    });
    // Ordering matters: clearing after the insert would delete the new row too.
    expect(deleteManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      createMock.mock.invocationCallOrder[0]!,
    );
  });

  it("retires and issues in one transaction", async () => {
    await createPasswordResetToken("user_1");

    // Split across two round trips, a failure in between leaves the user with
    // no link while the caller still reports success.
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(transactionMock.mock.calls[0]![0]).toHaveLength(2);
  });

  it("expires the token one TTL from now", async () => {
    await createPasswordResetToken("user_1");

    const { data } = createMock.mock.calls[0]![0];
    expect(data.expiresAt).toEqual(
      new Date(now.getTime() + RESET_TOKEN_TTL_SECONDS * 1000),
    );
  });
});

describe("isPasswordResetTokenValid", () => {
  it("asks the database about the hash, never the token", async () => {
    queryRawMock.mockResolvedValue([{ valid: false }]);

    await isPasswordResetTokenValid("plain-token");

    const values = queryValues(queryRawMock.mock.calls[0]!);
    expect(values).toContain(hashResetToken("plain-token"));
    expect(values).not.toContain("plain-token");
  });

  it("accepts a token the database vouches for", async () => {
    queryRawMock.mockResolvedValue([{ valid: true }]);
    expect(await isPasswordResetTokenValid("t")).toBe(true);
  });

  it("rejects one it does not", async () => {
    queryRawMock.mockResolvedValue([{ valid: false }]);
    expect(await isPasswordResetTokenValid("t")).toBe(false);
  });

  it("rejects rather than throwing if the query comes back empty", async () => {
    queryRawMock.mockResolvedValue([]);
    expect(await isPasswordResetTokenValid("t")).toBe(false);
  });
});

describe("consumePasswordResetToken", () => {
  it("returns the owner the DELETE handed back", async () => {
    queryRawMock.mockResolvedValue([{ userId: "user_1" }]);

    expect(await consumePasswordResetToken("t", prisma)).toBe("user_1");
    expect(queryValues(queryRawMock.mock.calls[0]!)).toContain(
      hashResetToken("t"),
    );
  });

  it("returns null when the statement matched nothing", async () => {
    // Unknown, already spent, or past `now()` — the caller must not be able to
    // tell these apart, and none of them yield a user.
    queryRawMock.mockResolvedValue([]);
    expect(await consumePasswordResetToken("t", prisma)).toBeNull();
  });

  it("runs on the transaction handle it is given", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ userId: "user_1" }]) };

    expect(await consumePasswordResetToken("t", tx)).toBe("user_1");
    // Otherwise the redeem commits on its own and the password write can still
    // fail behind it, burning the link for nothing.
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});

describe("cleanupExpiredPasswordResetTokens", () => {
  it("returns the number of rows deleted", async () => {
    deleteManyMock.mockResolvedValue({ count: 3 });

    expect(await cleanupExpiredPasswordResetTokens()).toBe(3);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    });
  });
});
