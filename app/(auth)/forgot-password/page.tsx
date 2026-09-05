import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  // Like /login and /signup, this page's job is to get you signed in — if you
  // already are, there is nothing here for you.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
        Forgot your password?
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Enter your email address and we&apos;ll send you a link to choose a new
        one.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{" "}
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
