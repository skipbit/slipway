import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateProfileSchema,
} from "@/lib/validations";

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "hunter2",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "hunter2",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid email address.");
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter your password.");
  });
});

describe("signupSchema", () => {
  it("accepts a valid name, email, and 8-char password", () => {
    const result = signupSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Password must be at least 8 characters.",
    );
  });

  it("rejects a password longer than 128 characters", () => {
    const result = signupSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Password must be 128 characters or fewer.",
    );
  });

  it("rejects an empty name", () => {
    const result = signupSchema.safeParse({
      name: "",
      email: "ada@example.com",
      password: "12345678",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter your name.");
  });

  it("rejects a name longer than 100 characters", () => {
    const result = signupSchema.safeParse({
      name: "a".repeat(101),
      email: "ada@example.com",
      password: "12345678",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Name must be 100 characters or fewer.",
    );
  });
});

describe("email length cap (shared by login, signup and reset)", () => {
  // An uncapped address becomes an oversized Postgres index key — RateLimit's
  // primary key and User.email's unique index both reject it from inside an
  // unauthenticated form. 254 is the RFC 5321 maximum.
  const overlong = `${"a".repeat(250)}@example.com`;

  it("rejects an address longer than 254 characters", () => {
    for (const [name, schema] of [
      ["login", loginSchema],
      ["forgotPassword", forgotPasswordSchema],
    ] as const) {
      const result = schema.safeParse({
        email: overlong,
        password: "12345678",
      });
      expect(result.success, name).toBe(false);
      expect(result.error?.issues[0]?.message, name).toBe(
        "Email must be 254 characters or fewer.",
      );
    }
  });

  it("rejects it on signup too", () => {
    const result = signupSchema.safeParse({
      name: "Ada",
      email: overlong,
      password: "12345678",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Email must be 254 characters or fewer.",
    );
  });

  it("still accepts an address exactly at the limit", () => {
    const atLimit = `${"a".repeat(254 - "@example.com".length)}@example.com`;
    expect(atLimit).toHaveLength(254);
    expect(forgotPasswordSchema.safeParse({ email: atLimit }).success).toBe(
      true,
    );
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "ada@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "ada@" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Enter a valid email address.",
    );
  });
});

describe("resetPasswordSchema", () => {
  const valid = {
    token: "a-token",
    password: "12345678",
    confirmPassword: "12345678",
  };

  it("accepts a token with two matching passwords", () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched confirmation, pointing at the field that is wrong", () => {
    const result = resetPasswordSchema.safeParse({
      ...valid,
      confirmPassword: "12345679",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Passwords do not match.");
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rejects a missing token", () => {
    const result = resetPasswordSchema.safeParse({ ...valid, token: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("This reset link is invalid.");
  });

  it("holds the new password to the same rules as signup", () => {
    const result = resetPasswordSchema.safeParse({
      ...valid,
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Password must be at least 8 characters.",
    );
  });

  it("reports the length problem before the mismatch", () => {
    // Field-level checks run before the object-level refine, so a short
    // password never gets masked by a "passwords do not match" message.
    const result = resetPasswordSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Password must be at least 8 characters.",
    );
  });
});

describe("updateProfileSchema", () => {
  it("accepts a valid name", () => {
    expect(updateProfileSchema.safeParse({ name: "Grace" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = updateProfileSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter your name.");
  });
});
