"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  RESET_TOKEN_TTL_SECONDS,
  consumePasswordResetToken,
  createPasswordResetToken,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import {
  getClientIp,
  rateLimit,
  type RateLimitConfig,
} from "@/lib/rate-limit";
import { externalUrl } from "@/lib/site";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations";

export type AuthFormState = { error: string | null };

/** Adds the "we sent it" line; only the request-a-link form has one. */
export type PasswordResetFormState = AuthFormState & {
  success: string | null;
};

// Per-IP throttles for credential auth. Tune to taste — shared NATs mean a
// whole office counts as one caller, so keep these generous enough for humans
// while still blunting brute force.
const LOGIN_LIMIT: RateLimitConfig = { max: 10, windowSeconds: 10 * 60 };
const SIGNUP_LIMIT: RateLimitConfig = { max: 5, windowSeconds: 60 * 60 };
// Reset requests get two buckets. The per-IP one blunts a script walking an
// address list; the per-email one caps how much mail any single address can be
// made to receive. Per-email buckets are created for addresses that may not
// exist, which is what the per-IP cap is for — 5 rows per IP per hour,
// reclaimed by cleanupExpiredRateLimits().
//
// The email cap is deliberately the LOOSER of the two. Set below the IP cap it
// would hand any single attacker a lockout: burn a known victim's bucket and
// they cannot reset for the rest of the hour. At 10 it takes two or more IPs to
// do that, while an inbox still can't be flooded with more than ten of these an
// hour. There is no setting that removes the lockout entirely — telling a
// throttled caller apart from an unthrottled one is the same oracle the neutral
// response exists to close.
const FORGOT_PASSWORD_IP_LIMIT: RateLimitConfig = {
  max: 5,
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

/**
 * Count one hit against `key` and return the state to hand straight back when
 * the caller is over the limit, or null to carry on.
 *
 * Returning the state rather than a boolean keeps the "what do we tell them"
 * decision in one place across all four actions — the shape that used to be
 * six lines at every entry point, with the `if` easy to leave out.
 */
async function throttle(
  key: string,
  { max, windowSeconds }: RateLimitConfig,
): Promise<PasswordResetFormState | null> {
  const limit = await rateLimit(key, max, windowSeconds);
  if (limit.success) return null;

  const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
  return {
    error: `Too many attempts. Try again in about ${minutes} minute${
      minutes === 1 ? "" : "s"
    }.`,
    success: null,
  };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = await getClientIp();
  const blocked = await throttle(`login:${ip}`, LOGIN_LIMIT);
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

  const ip = await getClientIp();
  const blocked = await throttle(`signup:${ip}`, SIGNUP_LIMIT);
  if (blocked) return blocked;

  // signupSchema already trimmed and lower-cased it.
  const email = parsed.data.email;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists. Log in instead." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash },
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
 * RESIDUAL LEAK: sending mail takes longer than not sending it, so response
 * time still correlates with account existence. Closing that properly means
 * handing the send to a queue and returning immediately — worth doing if you
 * are a target, overkill for most. The message itself gives nothing away.
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

  const ip = await getClientIp();
  const ipBlocked = await throttle(`forgot:ip:${ip}`, FORGOT_PASSWORD_IP_LIMIT);
  if (ipBlocked) return ipBlocked;

  const email = parsed.data.email;
  // Keyed on what was typed, not on what exists, so being throttled here says
  // nothing about whether the account is real.
  const emailBlocked = await throttle(
    `forgot:email:${email}`,
    FORGOT_PASSWORD_EMAIL_LIMIT,
  );
  if (emailBlocked) return emailBlocked;

  const user = await prisma.user.findUnique({ where: { email } });

  // Only credential accounts get a link. A Google-only account has no password
  // to reset, and minting one here would quietly add a second way in to an
  // account whose owner chose SSO — they use the Google button instead. If you
  // want the other reading ("the verified email *is* the identity, so let them
  // set a password"), drop the passwordHash check and this becomes that.
  if (user?.passwordHash) {
    try {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(
        user.email,
        externalUrl(`/reset-password?token=${encodeURIComponent(token)}`),
        RESET_TOKEN_TTL_SECONDS,
      );
    } catch (err) {
      // Swallowed on purpose: which addresses fail to send is itself a signal,
      // and the user can simply request another link. The operator gets the
      // real reason in the server log.
      console.error("[password-reset] failed to send reset email", err);
    }
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

  const ip = await getClientIp();
  const blocked = await throttle(`reset:${ip}`, RESET_PASSWORD_LIMIT);
  if (blocked) return blocked;

  // Hash before the transaction opens: bcrypt costs ~100ms and holding a
  // pooled connection through it is exactly how a pool runs dry. Doing it even
  // for a token that turns out to be bad is the price, and it has the side
  // benefit of making a valid and an invalid token take the same time.
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // Redeem and write together. Split apart, a failure on the update — the row
  // deleted in the meantime, the pool exhausted, the process recycled — would
  // leave the user with an unchanged password AND a spent link, sent back to a
  // /forgot-password bucket they have already paid into.
  const userId = await prisma.$transaction(async (tx) => {
    const id = await consumePasswordResetToken(parsed.data.token, tx);
    if (!id) return null;
    await tx.user.update({ where: { id }, data: { passwordHash } });
    return id;
  });

  if (!userId) {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  // redirect() throws — it must stay outside any try/catch that would swallow
  // it (same reason as the signIn calls above). Landing on /login rather than
  // signing them in proves the new password actually works.
  redirect("/login?reset=1");
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}
