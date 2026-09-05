"use server";

import { auth } from "@/lib/auth";
import { sendEmailVerificationLink } from "@/lib/email-token";
import { isEmailConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { rateLimit, type RateLimitConfig } from "@/lib/rate-limit";

/** What a dashboard form action hands back to `useActionState`. */
export type DashboardFormState = {
  error: string | null;
  success: string | null;
};

// Keyed on the user, not the IP: the caller is authenticated, so we know
// exactly whose inbox is being filled and there is no proxy to trust. Five an
// hour is generous for "it didn't arrive" and still stops a bored tab from
// mailing someone a hundred times.
const RESEND_VERIFICATION_LIMIT: RateLimitConfig = {
  max: 5,
  windowSeconds: 60 * 60,
};

export async function resendVerificationAction(
  _prev: DashboardFormState,
  _formData: FormData,
): Promise<DashboardFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in to request a new link.", success: null };
  }

  // Production with no mail credentials can never deliver, and "try again in a
  // few minutes" would be a lie about a permanently dead button. Safe to say
  // plainly here — unlike the reset form, the caller is authenticated and this
  // is their own address, so there is nothing to leak. lib/env.ts deliberately
  // lets a server boot this way; see its note.
  if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
    return {
      error: "Email isn't configured on this deployment. Contact support.",
      success: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return { error: "Sign in to request a new link.", success: null };
  if (user.emailVerified) {
    // Two tabs, or a link clicked between page load and this click. Checked
    // before the throttle: a no-op should not cost the user one of their five.
    return { error: null, success: "That address is already confirmed." };
  }

  const limit = await rateLimit(
    `verify:user:${session.user.id}`,
    RESEND_VERIFICATION_LIMIT.max,
    RESEND_VERIFICATION_LIMIT.windowSeconds,
  );
  if (!limit.success) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return {
      error: `Too many requests. Try again in about ${minutes} minute${
        minutes === 1 ? "" : "s"
      }.`,
      success: null,
    };
  }

  try {
    await sendEmailVerificationLink(user);
  } catch (err) {
    // The caller is authenticated and this is their own address, so unlike the
    // password reset flow there is no enumeration risk in saying it failed.
    console.error("[verify-email] resend failed", err);
    return {
      error: "We couldn't send that just now. Try again in a few minutes.",
      success: null,
    };
  }

  return {
    error: null,
    success: `Confirmation sent to ${user.email}. Check your inbox.`,
  };
}
