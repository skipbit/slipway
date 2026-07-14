import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, updateProfileSchema } from "@/lib/validations";

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
