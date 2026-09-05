import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { firstParam } from "@/lib/utils";
import { loginAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { AuthHeading } from "@/components/ui/auth-heading";
import { ErrorMessage, SuccessMessage } from "@/components/ui/message";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  // `?reset=1` is where resetPasswordAction lands after setting a new password.
  // `?verified=1` is where verifyEmailAction lands a visitor with no session.
  searchParams: Promise<{
    reset?: string | string[];
    verified?: string | string[];
    // Auth.js sends its failures here (pages.error in lib/auth.ts).
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const reset = firstParam(params.reset);
  const verified = firstParam(params.verified);
  const authError = firstParam(params.error);

  const session = await auth();
  if (session?.user) {
    // An Auth.js failure reaching a signed-in visitor came from connecting a
    // provider in Settings — `pages.error` is global and points here. Carry the
    // code back to where they started; the plain redirect below would drop it,
    // which is how the one failure this app actually produces ended up
    // invisible to the only people who can produce it.
    redirect(
      authError
        ? `/dashboard/settings?error=${encodeURIComponent(authError)}`
        : "/dashboard",
    );
  }

  return (
    <div>
      <AuthHeading
        title="Welcome back"
        subtitle="Log in to your account to continue."
      />

      {reset && (
        <SuccessMessage className="mt-6">
          Password updated. Log in with your new one.
        </SuccessMessage>
      )}

      {verified && (
        <SuccessMessage className="mt-6">
          Email confirmed. Log in to continue.
        </SuccessMessage>
      )}

      {authError && (
        <ErrorMessage className="mt-6">
          {authErrorMessage(authError)}
        </ErrorMessage>
      )}

      <div className="mt-8">
        <GoogleButton />
        <AuthDivider />
        <CredentialsForm mode="login" action={loginAction} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        No account yet? <TextLink href="/signup">Sign up</TextLink>
      </p>
    </div>
  );
}
