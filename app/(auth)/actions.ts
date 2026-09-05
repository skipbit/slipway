"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { AuthError } from "next-auth";
import { auth, hashPassword, signIn, signOut } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/env";
import {
  EMAIL_VERIFICATION_LINK,
  PASSWORD_RESET_LINK,
} from "@/lib/email-token";
import { prisma } from "@/lib/prisma";
import {
  getClientIp,
  opaqueKeyPart,
  throttleMessage,
  type RateLimitConfig,
} from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from "@/lib/validations";

export type AuthFormState = { error: string | null };

/** Prisma's unique-constraint violation, without importing the generated
 *  error class from a gitignored path. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/** Adds the "we sent it" line; only the request-a-link form has one. */
export type PasswordResetFormState = AuthFormState & {
  success: string | null;
};

// Per-IP throttles for credential auth. Tune to taste — shared NATs mean a
// whole office counts as one caller, so keep these generous enough for humans
// while still blunting brute force.
//
// These two predate the reset work and are left as they are, but read
// getClientIp() before deploying: if every visitor collapses into one bucket,
// 10 logins per 10 minutes is 10 for the entire install. Put a proxy in front
// that sets x-real-ip, or raise them the way FORGOT_PASSWORD_IP_LIMIT is
// raised below.
const LOGIN_LIMIT: RateLimitConfig = { max: 10, windowSeconds: 10 * 60 };
const SIGNUP_LIMIT: RateLimitConfig = { max: 5, windowSeconds: 60 * 60 };
// Reset requests get two buckets. The per-IP one blunts a script walking an
// address list; the per-email one caps how much mail any single address can be
// made to receive, and is keyed on a digest of the address (opaqueKeyPart) —
// rows are created for addresses that may not exist, and nothing calls
// cleanupExpiredRateLimits() yet, so storing them in the clear would build a
// permanent list of everything typed into a public form.
//
// The email cap is deliberately the LOOSER of the two. Set below the IP cap it
// would hand any single attacker a lockout: burn a known victim's bucket and
// they cannot reset for the rest of the hour. At 10 it takes two or more IPs to
// do that, while an inbox still can't be flooded with more than ten of these an
// hour. There is no setting that removes the lockout entirely — telling a
// throttled caller apart from an unthrottled one is the same oracle the neutral
// response exists to close.
//
// The IP cap is a VOLUME BRAKE, not a per-user control, and its number is
// chosen to survive the collapse described in getClientIp(): behind a plain
// published port every visitor can share one bucket, and a tight cap there
// would mean the sixth reset requested by anyone in an hour kills account
// recovery for the whole install — an outage dressed as a security control, on
// the one flow a locked-out user has no way around. 100/hr still blunts a bulk
// script (and protects sender reputation) while staying clear of any plausible
// legitimate volume; the per-address cap below is what actually binds.
const FORGOT_PASSWORD_IP_LIMIT: RateLimitConfig = {
  max: 100,
  windowSeconds: 60 * 60,
};
const FORGOT_PASSWORD_EMAIL_LIMIT: RateLimitConfig = {
  max: 10,
  windowSeconds: 60 * 60,
};
const RESET_PASSWORD_LIMIT: RateLimitConfig = {
  max: 10,
  windowSeconds: 60 * 60,
};
// Redeeming a confirmation link. Guessing is not the threat (256-bit tokens);
// this is only here so a flood of submissions cannot pound the database, and it
// is loose enough that a family behind one address never notices.
const VERIFY_EMAIL_LIMIT: RateLimitConfig = {
  max: 100,
  windowSeconds: 60 * 60,
};

/**
 * The throttle in the shape a form action returns. Returning the state rather
 * than a boolean means forgetting the `if` is not an option.
 */
async function throttle(
  key: string,
  config: RateLimitConfig,
): Promise<AuthFormState | null> {
  const error = await throttleMessage(key, config);
  return error ? { error } : null;
}

/**
 * The same, keyed on the caller's IP — and skipped entirely when no proxy
 * header identifies one, rather than dropping every visitor into a shared
 * bucket. See getClientIp() for why that fallback is worse than no limit.
 */
async function throttleByIp(
  prefix: string,
  config: RateLimitConfig,
): Promise<AuthFormState | null> {
  const ip = await getClientIp();
  if (!ip) return null;
  return throttle(`${prefix}:${ip}`, config);
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const blocked = await throttleByIp("login", LOGIN_LIMIT);
  if (blocked) return blocked;

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Next.js redirect() throws — let it propagate.
    throw err;
  }
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const blocked = await throttleByIp("signup", SIGNUP_LIMIT);
  if (blocked) return blocked;

  // signupSchema already trimmed and lower-cased it.
  const email = parsed.data.email;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists. Log in instead." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let user: { id: string; email: string };
  try {
    user = await prisma.user.create({
      data: { name: parsed.data.name, email, passwordHash },
    });
  } catch (err) {
    // The findUnique above is a check, not a lock: two signups for the same
    // address can both pass it and race to the insert. The unique index is the
    // real gate, so translate its complaint instead of letting an unhandled
    // exception escape a public action.
    if (isUniqueViolation(err)) {
      return {
        error: "An account with this email already exists. Log in instead.",
      };
    }
    throw err;
  }

  // Off the response path. Nobody waits on the result — the failure branch was
  // always just a log line — so making every signup wait on a round trip to
  // Resend (up to the 10s timeout) bought nothing. Never fail the signup over
  // it either: the account exists, the user can sign in, and the dashboard
  // offers a resend.
  after(async () => {
    try {
      await EMAIL_VERIFICATION_LINK.issueAndSend(user);
    } catch (err) {
      console.error("[verify-email] failed to send on signup", err);
    }
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try logging in." };
    }
    throw err;
  }
}

// The same sentence whether or not the address is on file. Anything that varies
// with account existence turns this form into a membership oracle, which is the
// one thing a reset form must not be.
const RESET_REQUESTED_MESSAGE =
  "If an account exists for that address, a reset link is on its way. Check your inbox.";

/**
 * Step 1 of the reset: email a single-use link.
 *
 * The send happens after the response, which is what keeps this from being a
 * timing oracle: issuing a token and posting to Resend takes far longer than
 * doing neither, so a caller could otherwise tell a real address from a
 * fictional one with a stopwatch, whatever the message said.
 */
export async function requestPasswordResetAction(
  _prev: PasswordResetFormState,
  formData: FormData,
): Promise<PasswordResetFormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      success: null,
    };
  }

  // Production with no mail credentials can never deliver, and the neutral
  // message would be a lie repeated forever. Saying so plainly is safe: the
  // answer depends on our configuration, not on whether the account exists, so
  // it is the same for everyone and leaks nothing. Development keeps the
  // console fallback and the neutral message.
  if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
    return {
      error:
        "Password reset is unavailable right now. Please contact support.",
      success: null,
    };
  }

  const ipBlocked = await throttleByIp(
    "forgot:ip",
    FORGOT_PASSWORD_IP_LIMIT,
  );
  if (ipBlocked) return { ...ipBlocked, success: null };

  const email = parsed.data.email;
  // Keyed on what was typed, not on what exists, so being throttled here says
  // nothing about whether the account is real.
  const emailBlocked = await throttle(
    `forgot:email:${opaqueKeyPart(email)}`,
    FORGOT_PASSWORD_EMAIL_LIMIT,
  );
  if (emailBlocked) return { ...emailBlocked, success: null };

  const user = await prisma.user.findUnique({ where: { email } });

  // Only credential accounts get a link. A Google-only account has no password
  // to reset, and minting one here would quietly add a second way in to an
  // account whose owner chose SSO — they use the Google button instead. If you
  // want the other reading ("the verified email *is* the identity, so let them
  // set a password"), drop the passwordHash check and this becomes that.
  if (user?.passwordHash) {
    const recipient = user;
    after(async () => {
      try {
        await PASSWORD_RESET_LINK.issueAndSend(recipient);
      } catch (err) {
        // Swallowed on purpose: which addresses fail to send is itself a
        // signal, and the user can simply request another link. The operator
        // gets the real reason in the server log.
        console.error("[password-reset] failed to send reset email", err);
      }
    });
  }

  return { error: null, success: RESET_REQUESTED_MESSAGE };
}

/**
 * Step 2: redeem the link and set the new password.
 *
 * KNOWN GAP: sessions are JWTs (see lib/auth.ts), so a session cookie stolen
 * before the reset keeps working until it expires — changing the password
 * cannot revoke what the server never stored. Closing it means giving User a
 * `passwordChangedAt` and comparing it against the token on every request,
 * which trades away the "no DB hit per request" property that made JWTs the
 * choice here. Decide that consciously rather than by default.
 */
export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const blocked = await throttleByIp("reset", RESET_PASSWORD_LIMIT);
  if (blocked) return blocked;

  // Hash before the transaction opens: bcrypt costs ~100ms and holding a
  // pooled connection through it is exactly how a pool runs dry. Doing it even
  // for a token that turns out to be bad is the price, and it has the side
  // benefit of making a valid and an invalid token take the same time.
  const passwordHash = await hashPassword(parsed.data.password);

  // Redeem and write together. Split apart, a failure on the update — the row
  // deleted in the meantime, the pool exhausted, the process recycled — would
  // leave the user with an unchanged password AND a spent link, sent back to a
  // /forgot-password bucket they have already paid into.
  // Redeeming this link proved control of the address it was sent to, which is
  // the whole of what verification asks for — so an unverified account that
  // recovers its password comes out verified rather than being asked to prove
  // the same thing twice.
  const userId = await PASSWORD_RESET_LINK.redeem(parsed.data.token, {
    passwordHash,
    emailVerified: new Date(),
  });

  if (!userId) {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  // signOut() rather than redirect(): the page deliberately serves a visitor
  // who is already signed in on this browser, and /login bounces an
  // authenticated session to /dashboard — so redirecting there would have shown
  // that visitor nothing at all. Ending the session also means the browser that
  // just changed the password re-authenticates with it, which is the only part
  // of the JWT revocation gap we can close from here. It throws to redirect,
  // like signIn above, so it stays outside any catch.
  await signOut({ redirectTo: "/login?reset=1" });

  // Unreachable: signOut throws to redirect. Unlike redirect(), its type does
  // not say so, so TypeScript still wants a return.
  return { error: null };
}

/**
 * Redeem a verification link.
 *
 * Driven by a button on /verify-email rather than by the GET, on purpose:
 * corporate mail scanners and link prefetchers follow URLs in email, and a
 * single-use token consumed on GET is one that the actual recipient then finds
 * expired. The page checks the token read-only and this spends it.
 */
export async function verifyEmailAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = verifyEmailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const blocked = await throttleByIp("verify", VERIFY_EMAIL_LIMIT);
  if (blocked) return blocked;

  const userId = await EMAIL_VERIFICATION_LINK.redeem(parsed.data.token, {
    emailVerified: new Date(),
  });

  if (!userId) {
    return {
      error:
        "This confirmation link is invalid or has expired. Sign in and ask for a new one.",
    };
  }

  // Someone can confirm from a different device than the one they signed up
  // on, so there may be no session here to send to the dashboard — and the
  // session there is may belong to somebody else, since the token deliberately
  // is not session-scoped. Only tell the dashboard "confirmed" when it is the
  // signed-in user's own address that just got confirmed.
  const session = await auth();
  redirect(
    session?.user?.id === userId ? "/dashboard?verified=1" : "/login?verified=1",
  );
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}
