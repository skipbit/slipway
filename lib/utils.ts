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

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
