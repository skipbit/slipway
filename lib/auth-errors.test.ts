import { describe, expect, it } from "vitest";

import { authErrorMessage, connectErrorMessage } from "@/lib/auth-errors";

describe("authErrorMessage", () => {
  it("tells a signed-out visitor how to get in and link", () => {
    expect(authErrorMessage("OAuthAccountNotLinked")).toContain(
      "already exists",
    );
    expect(authErrorMessage("OAuthAccountNotLinked")).toContain("Settings");
  });

  it("falls back for an unknown code", () => {
    expect(authErrorMessage("SomethingNobodyHasHeardOf")).toBe(
      "Something went wrong. Please try again.",
    );
    expect(authErrorMessage(undefined)).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("does not hand back an inherited property", () => {
    // A bare `MAP[code] ?? fallback` returns Object.prototype.constructor here
    // — a function, which reaching React as a child is an error on a page
    // anyone can request.
    for (const code of ["constructor", "toString", "hasOwnProperty"]) {
      expect(typeof authErrorMessage(code), code).toBe("string");
      expect(authErrorMessage(code), code).toBe(
        "Something went wrong. Please try again.",
      );
    }
  });
});

describe("connectErrorMessage", () => {
  it("describes the other situation for someone already signed in", () => {
    // Same Auth.js code, different cause: their session is fine, the Google
    // account is somebody else's. "Log in below" would be nonsense.
    const message = connectErrorMessage("OAuthAccountNotLinked");
    expect(message).toContain("already connected to another user");
    expect(message).not.toBe(authErrorMessage("OAuthAccountNotLinked"));
  });

  it("shares the fallback", () => {
    expect(connectErrorMessage("Whatever")).toBe(authErrorMessage("Whatever"));
  });
});
