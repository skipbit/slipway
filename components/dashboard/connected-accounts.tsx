"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  connectGoogleAction,
  disconnectGoogleAction,
  type DashboardFormState,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { FormMessages } from "@/components/ui/message";

/**
 * `useFormStatus` rather than `useActionState`: connectGoogleAction leaves for
 * Google instead of returning, so there is no state — but there are two server
 * round trips before the browser goes anywhere, and without a pending state a
 * second click starts a second authorisation whose PKCE cookies overwrite the
 * first's, so the callback fails its state check.
 */
function ConnectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" loading={pending}>
      Connect
    </Button>
  );
}

/**
 * Connect or disconnect Google from inside an authenticated session — see
 * `connectGoogleAction` for why that is the only place linking is safe.
 */
export function ConnectedAccounts({
  connected,
  removable,
  canConnect,
}: {
  connected: boolean;
  /** False when this is the account's only way back in. */
  removable: boolean;
  /** False when Google credentials are not configured on this deployment. */
  canConnect: boolean;
}) {
  const [state, disconnect, disconnecting] = useActionState<
    DashboardFormState,
    FormData
  >(disconnectGoogleAction, { error: null, success: null });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <GoogleIcon />
        <span className="min-w-0 flex-1 text-sm text-slate-900">Google</span>

        {connected ? (
          <form action={disconnect}>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={disconnecting}
              disabled={!removable}
            >
              Disconnect
            </Button>
          </form>
        ) : (
          <form action={connectGoogleAction}>
            <ConnectButton />
          </form>
        )}
      </div>

      {connected && !canConnect && (
        // The operator removed AUTH_GOOGLE_ID/SECRET while this was attached.
        // Saying so beats a row that looks fine but cannot be used.
        <p className="text-sm text-slate-500">
          Google sign-in is not configured on this deployment, so this
          connection cannot be used — but it can still be removed.
        </p>
      )}

      {connected && !removable && (
        // Visible text, not a `title` on the disabled button: Firefox and
        // Safari send no pointer events to a disabled control, so the tooltip
        // would never appear — leaving a greyed-out button and no reason.
        <p className="text-sm text-slate-500">
          This is the only way you can sign in, so it cannot be removed.
        </p>
      )}

      <FormMessages state={state} />
    </div>
  );
}
