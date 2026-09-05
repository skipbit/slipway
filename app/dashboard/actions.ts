"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { EMAIL_VERIFICATION_LINK } from "@/lib/email-token";
import { emailDeliveryUnavailable } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { throttleMessage, type RateLimitConfig } from "@/lib/rate-limit";
import { canDisconnect } from "@/lib/auth-policy";

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

  // "Try again in a few minutes" would be a lie about a permanently dead
  // button. Safe to say plainly: the caller is authenticated and this is their
  // own address, so there is nothing to leak. lib/env.ts deliberately lets a
  // server boot this way; see its note.
  if (emailDeliveryUnavailable()) {
    return {
      error: "Email isn't configured on this deployment. Contact support.",
      success: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    // Only what the resend needs — no reason to pull a bcrypt hash into memory.
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) return { error: "Sign in to request a new link.", success: null };
  if (user.emailVerified) {
    // Two tabs, or a link clicked between page load and this click. Checked
    // before the throttle: a no-op should not cost the user one of their five.
    return { error: null, success: "That address is already confirmed." };
  }

  const blocked = await throttleMessage(
    `verify:user:${session.user.id}`,
    RESEND_VERIFICATION_LIMIT,
    "requests",
  );
  if (blocked) return { error: blocked, success: null };

  try {
    await EMAIL_VERIFICATION_LINK.issueAndSend(user);
  } catch (err) {
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

/**
 * Connect Google to the account you are already signed in as.
 *
 * An ordinary sign-in, started from a page that already required a session —
 * see the Google provider comment in lib/auth.ts for why that is the only safe
 * way to link. A failure comes back as `?error=` on this page.
 *
 * No form state, because there is nothing to return: signIn throws to redirect.
 */
export async function connectGoogleAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await signIn("google", {
    redirectTo: "/dashboard/settings?connected=google",
  });
}

/**
 * Detach Google.
 *
 * Named for the provider, like its opposite number, rather than taking one as a
 * form field: the UI renders exactly one row, so a parameter would be an
 * abstraction with a single caller and a validation branch nothing can reach.
 * A second provider parameterises both sides at once.
 *
 * The rule about not leaving an account without a way in is `canDisconnect`, so
 * that this and the settings page — which uses it to stop offering a button
 * that can only fail — cannot come to different conclusions.
 */
export async function disconnectGoogleAction(
  _prev: DashboardFormState,
  _formData: FormData,
): Promise<DashboardFormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, accounts: { select: { provider: true } } },
  });
  if (!user) redirect("/login");

  if (!canDisconnect(user, "google")) {
    return {
      error:
        "That is your only way to sign in — disconnecting it would lock you out.",
      success: null,
    };
  }

  // deleteMany, not delete: the row is keyed by (provider, providerAccountId),
  // which this action does not know, and scoping by userId is what keeps one
  // user from detaching another's.
  await prisma.account.deleteMany({
    where: { userId: session.user.id, provider: "google" },
  });

  revalidatePath("/dashboard/settings");
  return { error: null, success: "Disconnected." };
}
