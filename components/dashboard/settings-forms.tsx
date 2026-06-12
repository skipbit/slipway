"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  deleteAccountAction,
  updateProfileAction,
  type SettingsFormState,
} from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(updateProfileAction, { error: null, success: null });

  return (
    <form action={formAction} className="space-y-4">
      <div className="max-w-sm">
        <Label htmlFor="name">Name</Label>
        <div className="mt-1.5">
          <Input
            id="name"
            name="name"
            type="text"
            defaultValue={defaultName}
            required
          />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-600">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}

export function DeleteAccountForm() {
  return (
    <form
      action={deleteAccountAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete your account permanently? This cannot be undone.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <Button variant="danger" type="submit">
        Delete account
      </Button>
    </form>
  );
}
