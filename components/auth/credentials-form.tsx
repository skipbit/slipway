"use client";

import { useActionState } from "react";
import { type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/validations";
import { ErrorMessage } from "@/components/ui/message";
import { TextLink } from "@/components/ui/text-link";

interface CredentialsFormProps {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}

export function CredentialsForm({ mode, action }: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-5">
      {mode === "signup" && (
        <div>
          <Label htmlFor="name">Name</Label>
          <div className="mt-1.5">
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Ada Lovelace"
            />
          </div>
        </div>
      )}

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

      <div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          {mode === "login" && (
            <TextLink href="/forgot-password" className="text-sm">
              Forgot password?
            </TextLink>
          )}
        </div>
        <div className="mt-1.5">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : 1}
            placeholder={
              mode === "signup"
                ? `At least ${PASSWORD_MIN_LENGTH} characters`
                : "••••••••"
            }
          />
        </div>
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <Button type="submit" loading={pending} className="w-full">
        {mode === "login" ? "Log in" : "Create account"}
      </Button>
    </form>
  );
}
