"use client";

import { useActionState } from "react";
import {
  verifyEmailAction,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/message";

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    verifyEmailAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <Button type="submit" loading={pending} className="w-full">
        Confirm email
      </Button>
    </form>
  );
}
