import { afterEach, describe, expect, it, vi } from "vitest";

import { externalUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("externalUrl", () => {
  it("uses APP_URL when it is set", () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    expect(externalUrl("/reset-password?token=x")).toBe(
      "https://app.example.com/reset-password?token=x",
    );
  });

  it("falls back when APP_URL is an empty string", () => {
    // `.env.example` ships APP_URL="" and dotenv assigns it verbatim. With `??`
    // instead of `||` this produced a relative link — dead in every mail
    // client, and the documented `cp .env.example .env` path hits it.
    vi.stubEnv("APP_URL", "");
    expect(externalUrl("/reset-password?token=x")).toMatch(/^https?:\/\//);
  });

  it("falls back when APP_URL is only whitespace", () => {
    vi.stubEnv("APP_URL", "   ");
    expect(externalUrl("/reset-password?token=x")).toMatch(/^https?:\/\//);
  });

  it("falls back when APP_URL is unset", () => {
    vi.stubEnv("APP_URL", undefined);
    expect(externalUrl("/reset-password?token=x")).toMatch(/^https?:\/\//);
  });

  it("does not double the slash when APP_URL has a trailing one", () => {
    vi.stubEnv("APP_URL", "https://app.example.com/");
    expect(externalUrl("/login")).toBe("https://app.example.com/login");
  });

  it("never returns a relative URL", () => {
    for (const value of ["", "  ", undefined, "https://x.example.com"]) {
      vi.stubEnv("APP_URL", value as string);
      expect(externalUrl("/p"), `APP_URL=${JSON.stringify(value)}`).toMatch(
        /^https?:\/\//,
      );
    }
  });
});
