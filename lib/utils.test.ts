import { describe, expect, it } from "vitest";
import { cn, firstParam, formatDate, humanDuration } from "@/lib/utils";

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

describe("firstParam", () => {
  // Next gives an array whenever a query key repeats; every caller used to
  // re-derive that, and the one that didn't threw on a public route.
  it("passes a single value straight through", () => {
    expect(firstParam("abc")).toBe("abc");
  });

  it("takes the first of a repeated key", () => {
    expect(firstParam(["a", "b"])).toBe("a");
  });

  it("returns undefined for a missing parameter", () => {
    expect(firstParam(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty array rather than a hole", () => {
    expect(firstParam([])).toBeUndefined();
  });
});

describe("humanDuration", () => {
  // The emails and the "this link expired" pages both explain the same number;
  // one saying "1 day" while the other says "24 hours" reads like a bug.
  it("keeps sub-hour lifetimes in minutes", () => {
    expect(humanDuration(15 * 60)).toBe("15 minutes");
    expect(humanDuration(59 * 60)).toBe("59 minutes");
  });

  it("singularises every unit, not just the big ones", () => {
    expect(humanDuration(60)).toBe("1 minute");
    expect(humanDuration(60 * 60)).toBe("1 hour");
    expect(humanDuration(24 * 60 * 60)).toBe("1 day");
  });

  it("says an hour rather than sixty minutes", () => {
    expect(humanDuration(60 * 60)).toBe("1 hour");
    expect(humanDuration(2 * 60 * 60)).toBe("2 hours");
    expect(humanDuration(90 * 60)).toBe("2 hours");
  });

  it("moves to days at a day, and singularises", () => {
    expect(humanDuration(24 * 60 * 60)).toBe("1 day");
    expect(humanDuration(48 * 60 * 60)).toBe("2 days");
  });
});
