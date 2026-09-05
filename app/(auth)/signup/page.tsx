import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signupAction } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { AuthHeading } from "@/components/ui/auth-heading";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div>
      <AuthHeading
        title="Create your account"
        subtitle="Free to start. No credit card required."
      />

      <div className="mt-8">
        <GoogleButton />
        <AuthDivider />
        <CredentialsForm mode="signup" action={signupAction} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account? <TextLink href="/login">Log in</TextLink>
      </p>
    </div>
  );
}
