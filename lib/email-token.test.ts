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
// NOTE: expiry and the purpose match now live in SQL (`"purpose" = $2 AND
// "expiresAt" > now()`), so a mocked $queryRaw cannot exercise them — same
// limitation as the fixed-window reset in rate-limit.test.ts. What is covered
// here is the hashing, the shape of the statements, and how their results are
// read. The purpose isolation is verified against a real Postgres in the
// browser run.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi.fn(),
        emailToken: {
          create: vi.fn().mockResolvedValue({}),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    ),
    emailToken: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_TOKEN_TTL_SECONDS,
  EmailTokenPurpose,
  cleanupExpiredEmailTokens,
  consumeEmailToken,
  generateEmailToken,
  hashEmailToken,
  isEmailTokenValid,
  issueEmailToken,
  sendEmailVerificationLink,
  sendPasswordResetLink,
} from "@/lib/email-token";

const queryRawMock = prisma.$queryRaw as unknown as Mock;
const transactionMock = prisma.$transaction as unknown as Mock;
const deleteManyMock = prisma.emailToken.deleteMany as unknown as Mock;
const sendResetMock = sendPasswordResetEmail as unknown as Mock;
const sendVerifyMock = sendVerificationEmail as unknown as Mock;

const now = new Date("2026-07-14T00:00:00.000Z");

/** The interpolated values of a tagged-template $queryRaw call. */
function queryValues(call: unknown[]): unknown[] {
  return call.slice(1);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
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

describe("EMAIL_TOKEN_TTL_SECONDS", () => {
  it("keeps a reset link far shorter than a confirmation link", () => {
    // A reset link is a live credential for an account someone is already
    // struggling to get into; a confirmation link only asserts an address.
    expect(EMAIL_TOKEN_TTL_SECONDS.PASSWORD_RESET).toBeLessThan(
      EMAIL_TOKEN_TTL_SECONDS.EMAIL_VERIFICATION,
    );
  });
});

describe("issueEmailToken", () => {
  it("stores the hash, never the token it returns", async () => {
    let created: { data: { tokenHash: string } } | undefined;
    transactionMock.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi.fn(),
        emailToken: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockImplementation((args) => {
            created = args;
            return Promise.resolve({});
          }),
        },
      }),
    );

    const token = await issueEmailToken(
      "user_1",
      EmailTokenPurpose.PASSWORD_RESET,
    );

    expect(created!.data.tokenHash).toBe(hashEmailToken(token));
    expect(JSON.stringify(created!.data)).not.toContain(token);
  });

  it("retires only the same purpose, and expires at that purpose's TTL", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    let created: { data: { purpose: string; expiresAt: Date } } | undefined;
    transactionMock.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi.fn(),
        emailToken: {
          deleteMany,
          create: vi.fn().mockImplementation((args) => {
            created = args;
            return Promise.resolve({});
          }),
        },
      }),
    );

    await issueEmailToken("user_1", EmailTokenPurpose.EMAIL_VERIFICATION);

    // A new reset link must not silently cancel a pending confirmation.
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", purpose: "EMAIL_VERIFICATION" },
    });
    expect(created!.data.expiresAt).toEqual(
      new Date(
        now.getTime() + EMAIL_TOKEN_TTL_SECONDS.EMAIL_VERIFICATION * 1000,
      ),
    );
  });

  it("does it all in one transaction", async () => {
    await issueEmailToken("user_1", EmailTokenPurpose.PASSWORD_RESET);
    expect(transactionMock).toHaveBeenCalledOnce();
  });
});

describe("isEmailTokenValid", () => {
  it("asks the database about the hash and the purpose, never the token", async () => {
    queryRawMock.mockResolvedValue([{ valid: false }]);

    await isEmailTokenValid("plain-token", EmailTokenPurpose.PASSWORD_RESET);

    const values = queryValues(queryRawMock.mock.calls[0]!);
    expect(values).toContain(hashEmailToken("plain-token"));
    expect(values).toContain("PASSWORD_RESET");
    expect(values).not.toContain("plain-token");
  });

  it("accepts a token the database vouches for", async () => {
    queryRawMock.mockResolvedValue([{ valid: true }]);
    expect(
      await isEmailTokenValid("t", EmailTokenPurpose.EMAIL_VERIFICATION),
    ).toBe(true);
  });

  it("rejects rather than throwing if the query comes back empty", async () => {
    queryRawMock.mockResolvedValue([]);
    expect(await isEmailTokenValid("t", EmailTokenPurpose.PASSWORD_RESET)).toBe(
      false,
    );
  });
});

describe("consumeEmailToken", () => {
  it("returns the owner the DELETE handed back", async () => {
    queryRawMock.mockResolvedValue([{ userId: "user_1" }]);

    expect(
      await consumeEmailToken("t", EmailTokenPurpose.PASSWORD_RESET, prisma),
    ).toBe("user_1");
  });

  it("scopes the DELETE to the purpose it was asked for", async () => {
    // Without this, a confirmation link — which anyone gets by signing up —
    // would be redeemable at /reset-password.
    queryRawMock.mockResolvedValue([]);

    await consumeEmailToken("t", EmailTokenPurpose.PASSWORD_RESET, prisma);

    expect(queryValues(queryRawMock.mock.calls[0]!)).toContain(
      "PASSWORD_RESET",
    );
  });

  it("returns null when the statement matched nothing", async () => {
    queryRawMock.mockResolvedValue([]);
    expect(
      await consumeEmailToken("t", EmailTokenPurpose.PASSWORD_RESET, prisma),
    ).toBeNull();
  });

  it("runs on the transaction handle it is given", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ userId: "user_1" }]) };

    expect(
      await consumeEmailToken("t", EmailTokenPurpose.EMAIL_VERIFICATION, tx),
    ).toBe("user_1");
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});

describe("the link senders", () => {
  it("point a reset link at /reset-password with its own TTL", async () => {
    await sendPasswordResetLink({ id: "user_1", email: "ada@example.com" });

    const [to, url, ttl] = sendResetMock.mock.calls[0]!;
    expect(to).toBe("ada@example.com");
    expect(url).toContain("/reset-password?token=");
    expect(ttl).toBe(EMAIL_TOKEN_TTL_SECONDS.PASSWORD_RESET);
  });

  it("point a confirmation link at /verify-email with its own TTL", async () => {
    await sendEmailVerificationLink({ id: "user_1", email: "ada@example.com" });

    const [, url, ttl] = sendVerifyMock.mock.calls[0]!;
    // The page that redeems it and the purpose it is minted under have to agree;
    // they are two lines of the same function so that they cannot drift.
    expect(url).toContain("/verify-email?token=");
    expect(ttl).toBe(EMAIL_TOKEN_TTL_SECONDS.EMAIL_VERIFICATION);
  });

  it("send the plaintext token, which is never what was stored", async () => {
    await sendEmailVerificationLink({ id: "user_1", email: "ada@example.com" });

    const url = sendVerifyMock.mock.calls[0]![1] as string;
    const token = decodeURIComponent(url.split("token=")[1]!);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(url).not.toContain(hashEmailToken(token));
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
