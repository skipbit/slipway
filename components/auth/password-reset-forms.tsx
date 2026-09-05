"use client";

import { useActionState } from "react";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type AuthFormState,
  type PasswordResetFormState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ErrorMessage, SuccessMessage } from "@/components/ui/message";
import { TextLink } from "@/components/ui/text-link";
import { PASSWORD_MIN_LENGTH } from "@/lib/utils";

const requestInitialState: PasswordResetFormState = {
  error: null,
  success: null,
};
// The reset form has no success state — it redirects to /login on success.
const resetInitialState: AuthFormState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    PasswordResetFormState,
    FormData
  >(requestPasswordResetAction, requestInitialState);

  // Replace the form once the request lands, rather than inviting a second
  // submit that would only eat into the per-email throttle.
  if (state.success) {
    return (
      <div className="space-y-4">
        <SuccessMessage>{state.success}</SuccessMessage>
        <p className="text-center text-sm text-slate-500">
          <TextLink href="/login">Back to log in</TextLink>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="email">Email address</Label>
        <div className="mt-1.5">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <Button type="submit" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    resetPasswordAction,
    resetInitialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="password">New password</Label>
        <div className="mt-1.5">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <div className="mt-1.5">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            placeholder="Type it again"
          />
        </div>
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <Button type="submit" loading={pending} className="w-full">
        Update password
      </Button>
    </form>
  );
}
