/**
 * What Auth.js's `?error=` codes mean, in the app's words.
 *
 * Next to nothing else, because two pages read it: /login shows it to a visitor
 * with no session, and /dashboard/settings shows it to one who was connecting a
 * provider — the failure that actually happens can only happen to the latter.
 */
const AUTH_ERRORS: Record<string, string> = {
  // Seen by someone with no session: they tried Google, and an account with
  // that address already exists — almost always their own, made with a
  // password. Linking is only allowed from a session, so that is the route.
  OAuthAccountNotLinked:
    "An account with that email address already exists. Log in below, then connect Google from Settings.",
  AccessDenied:
    "That provider did not confirm your email address, so we cannot use it to sign you in.",
};

const DEFAULT_MESSAGE = "Something went wrong. Please try again.";

/**
 * `Object.hasOwn`, not `code in` or a bare lookup: a plain object inherits
 * `constructor`, `toString` and friends, so `AUTH_ERRORS[code] ?? fallback`
 * hands back a *function* for `?error=constructor` — and a function reaching
 * React as a child is an error on an unauthenticated page.
 */
export function authErrorMessage(code: string | undefined): string {
  if (!code) return DEFAULT_MESSAGE;
  return Object.hasOwn(AUTH_ERRORS, code) ? AUTH_ERRORS[code]! : DEFAULT_MESSAGE;
}

/**
 * The same failures worded for someone who was already signed in and attaching
 * a provider from Settings, where any "sign in" advice makes no sense.
 *
 * Every code the connect flow can produce needs an entry here, not just the
 * common one — a forgotten code falls through to sign-in wording aimed at
 * somebody who is already signed in.
 */
const CONNECT_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That Google account is already connected to another user. Disconnect it there first, or use a different one.",
  AccessDenied:
    "Google did not confirm that address, so we cannot attach it to your account.",
};

export function connectErrorMessage(code: string | undefined): string {
  if (code && Object.hasOwn(CONNECT_ERRORS, code)) return CONNECT_ERRORS[code]!;
  return DEFAULT_MESSAGE;
}

/** The codes the connect flow can actually produce. */
export function isConnectError(code: string | undefined): boolean {
  return Boolean(code && Object.hasOwn(CONNECT_ERRORS, code));
}
