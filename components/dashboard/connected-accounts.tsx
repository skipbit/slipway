"use client";

import { useActionState } from "react";
import {
  connectGoogleAction,
  disconnectOAuthAccountAction,
  type DashboardFormState,
} from "@/app/dashboard/actions";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import { FormMessages } from "@/components/ui/message";

const initialState: DashboardFormState = { error: null, success: null };

/**
 * Connect or disconnect Google from inside an authenticated session — see
 * `connectGoogleAction` for why that is the only place linking is safe.
 *
 * Only rendered when Google is configured; the settings page owns that branch
 * so an install without credentials doesn't hydrate a component to show one
 * static line.
 */
export function ConnectedAccounts({
  connected,
  removable,
}: {
  connected: boolean;
  /** False when this is the account's only way back in. */
  removable: boolean;
}) {
  const [state, disconnect, disconnecting] = useActionState<
    DashboardFormState,
    FormData
  >(disconnectOAuthAccountAction, initialState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <GoogleIcon />
        <span className="min-w-0 flex-1 text-sm text-slate-900">Google</span>

        {connected ? (
          <form action={disconnect}>
            <input type="hidden" name="provider" value="google" />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={disconnecting}
              disabled={!removable}
              title={
                removable
                  ? undefined
                  : "This is your only way to sign in — set a password first."
              }
            >
              Disconnect
            </Button>
          </form>
        ) : (
          // A plain form: connectGoogleAction leaves for Google rather than
          // returning, so there is no state to render and no spinner to show.
          <form action={connectGoogleAction}>
            <Button type="submit" variant="secondary" size="sm">
              Connect
            </Button>
          </form>
        )}
      </div>

      <FormMessages state={state} />
    </div>
  );
}
