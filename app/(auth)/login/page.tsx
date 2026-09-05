import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loginAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { SuccessMessage } from "@/components/ui/message";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  // `?reset=1` is where resetPasswordAction lands after setting a new password.
  // Array because a repeated key gives one; only its truthiness is read.
  searchParams: Promise<{ reset?: string | string[] }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { reset } = await searchParams;

  return (
    <div>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
        Welcome back
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Log in to your account to continue.
      </p>

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
        No account yet?{" "}
        <Link
          href="/signup"
          className="font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
