"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

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
        <Label htmlFor="password">Password</Label>
        <div className="mt-1.5">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 8 : 1}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
          />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "login" ? "Log in" : "Create account"}
      </Button>
    </form>
  );
}
