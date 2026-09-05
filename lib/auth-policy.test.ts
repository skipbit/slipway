import { describe, expect, it } from "vitest";

import {
  canDisconnect,
  providerVouchedForEmail,
  signInMethods,
} from "@/lib/auth-policy";

const password = { passwordHash: "$2b$10$...", accounts: [] };
const googleOnly = {
  passwordHash: null,
  accounts: [{ provider: "google" }],
};
const both = {
  passwordHash: "$2b$10$...",
  accounts: [{ provider: "google" }],
};

describe("signInMethods", () => {
  it("counts a password as a method", () => {
    expect(signInMethods(password)).toEqual(["password"]);
  });

  it("lists providers", () => {
    expect(signInMethods(googleOnly)).toEqual(["google"]);
    expect(signInMethods(both)).toEqual(["password", "google"]);
  });

  it("returns nothing for an account with neither", () => {
    expect(signInMethods({ passwordHash: null, accounts: [] })).toEqual([]);
  });
});

describe("canDisconnect", () => {
  it("allows removing a provider when a password remains", () => {
    expect(canDisconnect(both, "google")).toBe(true);
  });

  it("refuses to remove the only way in", () => {
    // No password, and no way to set one — reset only mails accounts that
    // already have a hash — so this would be a locked door with no key.
    expect(canDisconnect(googleOnly, "google")).toBe(false);
  });

  it("allows removing a provider when another provider remains", () => {
    expect(
      canDisconnect(
        {
          passwordHash: null,
          accounts: [{ provider: "google" }, { provider: "github" }],
        },
        "google",
      ),
    ).toBe(true);
  });

  it("is unbothered by a provider that is not attached", () => {
    expect(canDisconnect(password, "google")).toBe(true);
  });
});

describe("providerVouchedForEmail", () => {
  it("accepts a provider that vouched", () => {
    expect(
      providerVouchedForEmail({ type: "oidc" }, { email_verified: true }),
    ).toBe(true);
  });

  it("refuses one that says outright it did not", () => {
    expect(
      providerVouchedForEmail({ type: "oidc" }, { email_verified: false }),
    ).toBe(false);
  });

  it("covers plain OAuth 2.0 providers, not just OIDC", () => {
    // GitHub, Discord and friends are typed "oauth" — the earlier version of
    // this rule only looked at "oidc" and let them straight through.
    expect(
      providerVouchedForEmail({ type: "oauth" }, { email_verified: false }),
    ).toBe(false);
  });

  it("accepts a provider that says nothing either way", () => {
    expect(providerVouchedForEmail({ type: "oauth" }, {})).toBe(true);
    expect(providerVouchedForEmail({ type: "oidc" }, null)).toBe(true);
  });

  it("leaves non-OAuth sign-ins alone", () => {
    expect(
      providerVouchedForEmail({ type: "credentials" }, { email_verified: false }),
    ).toBe(true);
    expect(providerVouchedForEmail(null, null)).toBe(true);
  });
});
