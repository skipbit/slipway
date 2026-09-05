import { describe, expect, it } from "vitest";

import { productionConfigProblems } from "@/lib/env";

const configured = {
  NODE_ENV: "production",
  APP_URL: "https://app.example.com",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "Slipway <hi@example.com>",
};

describe("productionConfigProblems", () => {
  it("passes a fully configured production environment", () => {
    expect(productionConfigProblems(configured)).toEqual([]);
  });

  it("says nothing outside production", () => {
    // Development is the case the console fallback exists for.
    expect(productionConfigProblems({ NODE_ENV: "development" })).toEqual([]);
    expect(productionConfigProblems({ NODE_ENV: "test" })).toEqual([]);
  });

  it("requires APP_URL, because the fallback is a build-time localhost", () => {
    expect(productionConfigProblems({ ...configured, APP_URL: "" })).toEqual([
      expect.stringContaining("APP_URL is unset"),
    ]);
    expect(
      productionConfigProblems({ ...configured, APP_URL: undefined }),
    ).toHaveLength(1);
    expect(
      productionConfigProblems({ ...configured, APP_URL: "   " }),
    ).toHaveLength(1);
  });

  it("rejects an APP_URL that is not an absolute http(s) URL", () => {
    for (const value of ["app.example.com", "/reset", "ftp://x.example.com"]) {
      expect(
        productionConfigProblems({ ...configured, APP_URL: value }),
        value,
      ).toEqual([expect.stringContaining("not an absolute http(s) URL")]);
    }
  });

  it("rejects half-configured email in either direction", () => {
    expect(
      productionConfigProblems({ ...configured, EMAIL_FROM: "" }),
    ).toEqual([expect.stringContaining("EMAIL_FROM is missing")]);
    expect(
      productionConfigProblems({ ...configured, RESEND_API_KEY: "" }),
    ).toEqual([expect.stringContaining("RESEND_API_KEY is missing")]);
  });

  it("accepts email being unconfigured entirely", () => {
    // A supported state: the link is logged rather than sent, and
    // sendPasswordResetEmail refuses to do even that in production. Booting is
    // not the place to relitigate it.
    expect(
      productionConfigProblems({
        ...configured,
        RESEND_API_KEY: "",
        EMAIL_FROM: "",
      }),
    ).toEqual([]);
  });

  it("reports every problem at once, so one restart shows them all", () => {
    expect(
      productionConfigProblems({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_123",
      }),
    ).toHaveLength(2);
  });
});
