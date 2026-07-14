import { describe, expect, it } from "vitest";
import { cn, formatDate } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("skips falsy values (false, null, undefined)", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns an empty string when everything is falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });

  it("supports conditional expressions", () => {
    const active = true;
    const disabled = false;
    expect(cn("base", active && "active", disabled && "disabled")).toBe(
      "base active",
    );
  });
});

describe("formatDate", () => {
  it("formats a date as a long en-US string", () => {
    // Local-time construction (month is 0-indexed) keeps this deterministic
    // regardless of the runner's timezone.
    expect(formatDate(new Date(2026, 6, 14))).toBe("July 14, 2026");
  });
});
