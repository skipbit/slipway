import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { AuthHeading } from "@/components/ui/auth-heading";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  // Like /login and /signup, this page's job is to get you signed in — if you
  // already are, there is nothing here for you.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div>
      <AuthHeading
        title="Forgot your password?"
        subtitle="Enter your email address and we'll send you a link to choose a new one."
      />

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it? <TextLink href="/login">Log in</TextLink>
      </p>
    </div>
  );
}
