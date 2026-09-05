import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

// Only the Prisma and mailer boundaries are mocked — the crypto is real,
// because "the token we hand out is not the value we store" is exactly the
// property worth testing.
//
// NOTE: expiry and the purpose match live in SQL (`"purpose" = $2 AND
// "expiresAt" > now()`), so a mocked $queryRaw cannot exercise them — the same
// limitation as the fixed-window reset in rate-limit.test.ts. What IS pinned
// here is the wiring: that each flow pairs its purpose with the right URL, TTL
// and message, which is the mistake that would otherwise compile — a
// confirmation link redeemable as a password reset.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi.fn().mockResolvedValue([]),
        user: { update: vi.fn(), updateMany: vi.fn() },
      }),
    ),
    emailToken: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
// issueAndSend hands the provider call to after(); run it inline so the
// assertions can see what was sent.
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_VERIFICATION_LINK,
  PASSWORD_RESET_LINK,
  cleanupExpiredEmailTokens,
  generateEmailToken,
  hashEmailToken,
} from "@/lib/email-token";

const queryRawMock = prisma.$queryRaw as unknown as Mock;
const transactionMock = prisma.$transaction as unknown as Mock;
const upsertMock = prisma.emailToken.upsert as unknown as Mock;
const deleteManyMock = prisma.emailToken.deleteMany as unknown as Mock;
const sendResetMock = sendPasswordResetEmail as unknown as Mock;
const sendVerifyMock = sendVerificationEmail as unknown as Mock;

const now = new Date("2026-07-14T00:00:00.000Z");
const recipient = { id: "user_1", email: "ada@example.com" };

/** The interpolated values of a tagged-template $queryRaw call. */
function queryValues(call: unknown[]): unknown[] {
  return call.slice(1);
}

/** Runs the redeem transaction with a tx whose DELETE returns `rows`. */
function txReturning(rows: { userId: string }[]) {
  const queryRaw = vi.fn().mockResolvedValue(rows);
  const update = vi.fn();
  const updateMany = vi.fn();
  transactionMock.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: queryRaw, user: { update, updateMany } }),
  );
  return { queryRaw, update, updateMany };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  upsertMock.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateEmailToken", () => {
  it("emits 32 bytes of entropy", () => {
    expect(Buffer.from(generateEmailToken(), "base64url")).toHaveLength(32);
  });

  it("stays inside the URL-safe alphabet so it survives a query string", () => {
    expect(generateEmailToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateEmailToken));
    expect(tokens.size).toBe(50);
  });
});

describe("hashEmailToken", () => {
  it("is deterministic, so the unique index can find a row", () => {
    expect(hashEmailToken("abc")).toBe(hashEmailToken("abc"));
  });

  it("produces a 64-char hex digest", () => {
    expect(hashEmailToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("separates different tokens", () => {
    expect(hashEmailToken("abc")).not.toBe(hashEmailToken("abd"));
  });
});

// One table serves both flows, so the pairing of purpose with URL, TTL and
// wording is the whole safety story. These are the assertions that would fail
// if someone wired a flow to the other purpose.
describe.each([
  {
    name: "password reset",
    link: PASSWORD_RESET_LINK,
    purpose: "PASSWORD_RESET",
    path: "/reset-password",
    sender: () => sendResetMock,
  },
  {
    name: "email verification",
    link: EMAIL_VERIFICATION_LINK,
    purpose: "EMAIL_VERIFICATION",
    path: "/verify-email",
    sender: () => sendVerifyMock,
  },
])("the $name link", ({ link, purpose, path, sender }) => {
  it("stores its own purpose, and the hash rather than the token", async () => {
    await link.issueAndSend(recipient);

    const args = upsertMock.mock.calls[0]![0];
    const url = sender().mock.calls[0]![1] as string;
    const token = decodeURIComponent(url.split("token=")[1]!);

    expect(args.where.userId_purpose).toEqual({ userId: "user_1", purpose });
    expect(args.create.purpose).toBe(purpose);
    expect(args.create.tokenHash).toBe(hashEmailToken(token));
    expect(JSON.stringify(args)).not.toContain(token);
  });

  it("points at the page that redeems it, and quotes its own TTL", async () => {
    await link.issueAndSend(recipient);

    const [to, url, ttl] = sender().mock.calls[0]!;
    expect(to).toBe("ada@example.com");
    expect(url).toContain(`${path}?token=`);
    expect(ttl).toBe(link.ttlSeconds);
  });

  it("expires the row at its own TTL", async () => {
    await link.issueAndSend(recipient);

    const args = upsertMock.mock.calls[0]![0];
    const expected = new Date(now.getTime() + link.ttlSeconds * 1000);
    expect(args.create.expiresAt).toEqual(expected);
    expect(args.update.expiresAt).toEqual(expected);
  });

  it("replaces rather than accumulating — one live link per purpose", async () => {
    await link.issueAndSend(recipient);
    // The unique index makes this the database's rule; the upsert is how the
    // application spends one round trip instead of a locked delete-then-insert.
    expect(upsertMock).toHaveBeenCalledOnce();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("asks about its own purpose when checking a token", async () => {
    queryRawMock.mockResolvedValue([{ valid: true }]);

    expect(await link.isValid("plain-token")).toBe(true);

    const values = queryValues(queryRawMock.mock.calls[0]!);
    expect(values).toContain(hashEmailToken("plain-token"));
    expect(values).toContain(purpose);
    expect(values).not.toContain("plain-token");
  });

  it("scopes the redeem DELETE to its own purpose", async () => {
    // THE assertion this whole design rests on. Drop the purpose clause from
    // the DELETE and a confirmation link — which anyone gets by signing up —
    // becomes redeemable at /reset-password. Nothing else in the suite would
    // notice, because the mocked query returns whatever it is told to.
    const { queryRaw } = txReturning([{ userId: "user_1" }]);

    await link.redeem("plain-token");

    const values = queryValues(queryRaw.mock.calls[0]!);
    expect(values).toContain(purpose);
    expect(values).toContain(hashEmailToken("plain-token"));
    expect(values).not.toContain("plain-token");
  });

  it("applies the caller's data and returns the owner", async () => {
    const { update } = txReturning([{ userId: "user_1" }]);

    expect(await link.redeem("t", { name: "Ada" })).toBe("user_1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { name: "Ada" },
    });
  });

  it("confirms the address, promoting rather than overwriting", async () => {
    // Redeeming any mailed link proves control of the address. An existing
    // timestamp is when it was FIRST proved, so the `emailVerified: null`
    // filter is what stops a password reset moving it years forward.
    const { updateMany } = txReturning([{ userId: "user_1" }]);

    await link.redeem("t");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user_1", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
  });

  it("returns null and writes nothing when the token does not match", async () => {
    // Unknown, expired, already spent, or minted for the other purpose — the
    // caller must not be able to tell these apart, and none of them yield a user.
    const { update, updateMany } = txReturning([]);

    expect(await link.redeem("t", { name: "Ada" })).toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses an absurdly long token before hashing it", async () => {
    // The POST paths cap this in zod; the GET on a link-landing page does not,
    // so the bound lives here where both pass through.
    expect(await link.isValid("a".repeat(5000))).toBe(false);
    expect(await link.redeem("a".repeat(5000))).toBeNull();
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe("the two flows together", () => {
  it("keep a reset link far shorter than a confirmation link", () => {
    // A reset link is a live credential for an account someone is already
    // struggling to get into; a confirmation link only asserts an address.
    expect(PASSWORD_RESET_LINK.ttlSeconds).toBeLessThan(
      EMAIL_VERIFICATION_LINK.ttlSeconds,
    );
  });

  it("do not share a purpose", async () => {
    await PASSWORD_RESET_LINK.issueAndSend(recipient);
    await EMAIL_VERIFICATION_LINK.issueAndSend(recipient);

    const purposes = upsertMock.mock.calls.map((c) => c[0].create.purpose);
    expect(new Set(purposes).size).toBe(2);
  });
});

describe("cleanupExpiredEmailTokens", () => {
  it("returns the number of rows deleted", async () => {
    deleteManyMock.mockResolvedValue({ count: 3 });

    expect(await cleanupExpiredEmailTokens()).toBe(3);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    });
  });
});
