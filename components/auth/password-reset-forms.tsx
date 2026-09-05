"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type PasswordResetFormState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const initialState: PasswordResetFormState = { error: null, success: null };

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {children}
    </p>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    PasswordResetFormState,
    FormData
  >(requestPasswordResetAction, initialState);

  // Replace the form once the request lands, rather than inviting a second
  // submit that would only eat into the per-email throttle.
  if (state.success) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          {state.success}
        </p>
        <p className="text-center text-sm text-slate-500">
          <Link
            href="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Back to log in
          </Link>
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

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    PasswordResetFormState,
    FormData
  >(resetPasswordAction, initialState);

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
            minLength={8}
            placeholder="At least 8 characters"
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
            minLength={8}
            placeholder="Type it again"
          />
        </div>
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}
