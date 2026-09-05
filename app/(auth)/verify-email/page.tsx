import { type Metadata } from "next";
import {
  EMAIL_TOKEN_TTL_SECONDS,
  EmailTokenPurpose,
  isEmailTokenValid,
} from "@/lib/email-token";
import { firstParam, humanDuration } from "@/lib/utils";
import { LinkProblem } from "@/components/auth/link-problem";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { AuthHeading } from "@/components/ui/auth-heading";

export const metadata: Metadata = {
  title: "Confirm your email",
  // A URL that carries a live credential has no business in an index.
  robots: { index: false, follow: false },
};

/**
 * Confirms nothing on its own — the token is checked read-only here and spent
 * by the button. Mail scanners and link prefetchers follow URLs in email, and a
 * token consumed on GET is one the actual recipient finds already used.
 *
 * Signed in or not, this page works: someone can open the link on their phone
 * having signed up on a laptop.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = firstParam((await searchParams).token);

  if (!token) {
    return (
      <LinkProblem
        title="This link is incomplete"
        body="This address is missing its confirmation token — some mail clients cut long links in half. Try copying the whole link from the email."
        actionHref="/login"
        actionLabel="Back to log in"
      />
    );
  }

  if (!(await isEmailTokenValid(token, EmailTokenPurpose.EMAIL_VERIFICATION))) {
    return (
      <LinkProblem
        title="This link has expired"
        body={`Confirmation links are good for ${humanDuration(
          EMAIL_TOKEN_TTL_SECONDS.EMAIL_VERIFICATION,
        )} and can only be used once. Log in and we'll send you a fresh one.`}
        actionHref="/login"
        actionLabel="Log in to get a new link"
      />
    );
  }

  return (
    <div>
      <AuthHeading
        title="Confirm your email"
        subtitle="One click and this address is confirmed for your account."
      />
      <div className="mt-8">
        <VerifyEmailForm token={token} />
      </div>
    </div>
  );
}
