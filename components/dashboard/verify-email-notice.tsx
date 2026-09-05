"use client";

import { useActionState } from "react";
import { MailWarning } from "lucide-react";
import {
  resendVerificationAction,
  type DashboardFormState,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

/**
 * Shown while an account's address is unconfirmed.
 *
 * A nudge, not a wall: nothing in this boilerplate is gated on verification, so
 * a user who ignores this keeps working. Gate what matters for your product in
 * the page or action that matters — `user.emailVerified` is the flag, and
 * app/dashboard/layout.tsx is where a blanket rule would go.
 */
export function VerifyEmailNotice({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<
    DashboardFormState,
    FormData
  >(resendVerificationAction, { error: null, success: null });

  return (
    <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <div className="flex flex-wrap items-center gap-3">
        <MailWarning className="h-5 w-5 flex-none text-amber-600" />
        <p className="min-w-0 flex-1 text-sm text-amber-900">
          <span className="font-semibold">Confirm your email.</span> We sent a
          link to <span className="break-all">{email}</span>.
        </p>
        <form action={formAction}>
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            Resend
          </Button>
        </form>
      </div>

      {(state.error || state.success) && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            state.error ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {state.error ?? state.success}
        </p>
      )}
    </div>
  );
}
