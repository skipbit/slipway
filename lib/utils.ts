/**
 * Minimum password length, shared by the zod schema and the `minLength` on the
 * client inputs.
 *
 * It lives in this (schema-free) module rather than in lib/validations.ts
 * because the client components need it: importing lib/validations.ts from a
 * `"use client"` file executes every schema at module scope, which the bundler
 * cannot tree-shake, and ships zod plus all five schemas to the browser to
 * communicate the number 8.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Join class names, skipping falsy values. Minimal `clsx` replacement. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * The first value of a query parameter.
 *
 * Next hands back an array whenever a key repeats (`?token=a&token=b`), so a
 * page typing its `searchParams` as `string` is asserting something the router
 * does not guarantee — and the array reaches whatever the value is handed to.
 * One `createHash()` and it is an unhandled ERR_INVALID_ARG_TYPE on a public
 * route. Read every query parameter through this.
 */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A link lifetime in the units a human would say it in.
 *
 * Shared by the emails and by the pages that explain an expired link, because
 * the two saying "1 day" and "24 hours" about the same number reads like a bug
 * even when it isn't.
 */
export function humanDuration(seconds: number): string {
  // Floor, not round: this tells someone how long they have, so being wrong
  // should mean they act sooner, never later. Rounding turns a 90-minute link
  // into "2 hours".
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
