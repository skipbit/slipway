import { googleSignInAction } from "@/app/(auth)/actions";
import { isGoogleConfigured } from "@/lib/auth";
import { GOOGLE_NOT_CONFIGURED } from "@/lib/site";
import { GoogleIcon } from "@/components/ui/google-icon";

/**
 * Server component: renders a working Google sign-in button when
 * AUTH_GOOGLE_ID/SECRET are configured, otherwise a disabled hint.
 */
export function GoogleButton() {
  if (!isGoogleConfigured()) {
    return (
      <div
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-400 shadow-sm ring-1 ring-inset ring-slate-200"
        title={GOOGLE_NOT_CONFIGURED}
      >
        <GoogleIcon />
        Google (not configured)
      </div>
    );
  }

  return (
    <form action={googleSignInAction}>
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </form>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-white px-3 text-slate-500">or</span>
      </div>
    </div>
  );
}
