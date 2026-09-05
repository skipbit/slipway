import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { loginAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";

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
        <p
          role="status"
          className="mt-6 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          Password updated. Log in with your new one.
        </p>
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
