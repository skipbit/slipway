"use client";

import { useActionState } from "react";
import { MailWarning } from "lucide-react";
import {
  resendVerificationAction,
  type DashboardFormState,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { FormMessages } from "@/components/ui/message";

/**
 * Shown while an account's address is unconfirmed.
 *
 * A nudge, not a wall: nothing in this boilerplate is gated on verification, so
 * a user who ignores this keeps working. `user.emailVerified` is the flag, and
 * the cheap place to gate is the page or action that matters — those already
 * load the user. A blanket rule in app/dashboard/layout.tsx costs more than it
 * looks: that layout makes no database query today, and adding one there puts a
 * read on every dashboard request, which is the property the JWT session
 * strategy was chosen for.
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
          <span className="font-semibold">Confirm your email.</span>{" "}
          {/* Deliberately not "we sent a link": accounts that predate this
              feature never got one, and neither does anyone on a deployment
              with no mail credentials. Both see this notice. */}
          <span className="break-all">{email}</span> hasn&apos;t been confirmed
          yet.
        </p>
        <form action={formAction}>
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            Resend
          </Button>
        </form>
      </div>

      <FormMessages state={state} className="mt-3" />
    </div>
  );
}
