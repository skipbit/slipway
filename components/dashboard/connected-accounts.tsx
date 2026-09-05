"use client";

import { useActionState } from "react";
import {
  connectOAuthAccountAction,
  disconnectOAuthAccountAction,
  type DashboardFormState,
} from "@/app/dashboard/actions";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import { InlineMessage } from "@/components/ui/message";

const initialState: DashboardFormState = { error: null, success: null };

/**
 * Connect or disconnect Google from inside an authenticated session.
 *
 * The connect button starts an ordinary Google sign-in. That is the point:
 * Auth.js links the provider straight onto the session's user when a session
 * exists, which is the only safe way to link — see the note on the provider in
 * lib/auth.ts for what the convenient way costs.
 */
export function ConnectedAccounts({
  connected,
  configured,
}: {
  connected: boolean;
  configured: boolean;
}) {
  const [connectState, connect, connecting] = useActionState<
    DashboardFormState,
    FormData
  >(connectOAuthAccountAction, initialState);
  const [disconnectState, disconnect, disconnecting] = useActionState<
    DashboardFormState,
    FormData
  >(disconnectOAuthAccountAction, initialState);

  const state = connectState.error ? connectState : disconnectState;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <GoogleIcon />
        <span className="min-w-0 flex-1 text-sm text-slate-900">Google</span>

        {!configured ? (
          <span
            className="text-sm text-slate-400"
            title="Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in .env to enable"
          >
            Not configured
          </span>
        ) : connected ? (
          <form action={disconnect}>
            <input type="hidden" name="provider" value="google" />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={disconnecting}
            >
              Disconnect
            </Button>
          </form>
        ) : (
          <form action={connect}>
            <input type="hidden" name="provider" value="google" />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={connecting}
            >
              Connect
            </Button>
          </form>
        )}
      </div>

      {state.error && <InlineMessage tone="error">{state.error}</InlineMessage>}
      {state.success && (
        <InlineMessage tone="success">{state.success}</InlineMessage>
      )}
    </div>
  );
}
