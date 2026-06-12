import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signupAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Free to start. No credit card required.
      </p>

      <div className="mt-8">
        <GoogleButton />
        <AuthDivider />
        <CredentialsForm mode="signup" action={signupAction} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
