"use client";

import { useActionState } from "react";
import { type DashboardFormState } from "@/app/dashboard/actions";
import {
  deleteAccountAction,
  updateProfileAction,
} from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { InlineMessage } from "@/components/ui/message";

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<
    DashboardFormState,
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
      {state.error && <InlineMessage tone="error">{state.error}</InlineMessage>}
      {state.success && (
        <InlineMessage tone="success">{state.success}</InlineMessage>
      )}
      <Button type="submit" loading={pending}>
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
