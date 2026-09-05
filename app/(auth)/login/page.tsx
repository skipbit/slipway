import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { firstParam } from "@/lib/utils";
import { loginAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { AuthHeading } from "@/components/ui/auth-heading";
import { ErrorMessage, SuccessMessage } from "@/components/ui/message";

/**
 * Auth.js reports failures as a code in `?error=`. Only one of these is really
 * expected: a Google address that already belongs to an account, which happens
 * because linking is deliberately only allowed from a signed-in session — see
 * the provider note in lib/auth.ts.
 */
const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "An account with that email address already exists. Log in below, then connect Google from Settings.",
  AccessDenied:
    "That provider did not confirm your email address, so we cannot use it to sign you in.",
  Default: "Something went wrong signing you in. Please try again.",
};
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
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const params = await searchParams;
  const reset = firstParam(params.reset);
  const verified = firstParam(params.verified);
  const authError = firstParam(params.error);

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
          {AUTH_ERRORS[authError] ?? AUTH_ERRORS.Default}
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
