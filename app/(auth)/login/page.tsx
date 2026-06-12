import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loginAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
        Welcome back
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Log in to your account to continue.
      </p>

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
