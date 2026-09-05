import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { firstParam } from "@/lib/utils";
import { loginAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { AuthHeading } from "@/components/ui/auth-heading";
import { SuccessMessage } from "@/components/ui/message";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  // `?reset=1` is where resetPasswordAction lands after setting a new password.
  searchParams: Promise<{ reset?: string | string[] }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const reset = firstParam((await searchParams).reset);

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
