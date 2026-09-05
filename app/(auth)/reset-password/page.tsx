import { type Metadata } from "next";
import {
  EMAIL_TOKEN_TTL_SECONDS,
  EmailTokenPurpose,
  isEmailTokenValid,
} from "@/lib/email-token";
import { firstParam, humanDuration } from "@/lib/utils";
import { LinkProblem } from "@/components/auth/link-problem";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { AuthHeading } from "@/components/ui/auth-heading";

export const metadata: Metadata = {
  title: "Choose a new password",
  // A URL that carries a live credential has no business in an index.
  robots: { index: false, follow: false },
};

/**
 * Deliberately does NOT bounce a signed-in visitor to /dashboard the way
 * /login and /forgot-password do: the emailed link is itself the credential,
 * and someone already signed in on this browser still has every right to
 * finish setting a new password.
 *
 * The token is checked here so an expired link says so up front, instead of
 * after the visitor has typed a password twice. This is a read only — the
 * token is not spent until the form is submitted.
 *
 * Deliberately NOT behind rateLimit(), unlike every sibling auth entry point:
 * the check is one indexed SELECT, while rateLimit() is an upsert — throttling
 * a read with a write costs the connection pool more than it saves. Guessing is
 * not the threat either (256-bit tokens).
 *
 * Be clear on what that leaves: a request flood still becomes a query flood
 * against the shared pool, and nothing in this repo caps it. The cap belongs at
 * the edge (CDN, WAF, ingress) and you have to put it there — the argument
 * above is for why it does not belong in a per-request round trip, not a claim
 * that the route is protected.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = firstParam((await searchParams).token);

  // A link that arrived without a token was never valid — telling that visitor
  // their link "expired" sends them to request another one their mail client
  // will mangle exactly the same way.
  if (!token) {
    return (
      <LinkProblem
        title="This link is incomplete"
        body="This address is missing its reset token — some mail clients cut long links in half. Try copying the whole link from the email, or request a new one."
        actionHref="/forgot-password"
        actionLabel="Request a new link"
      />
    );
  }

  if (!(await isEmailTokenValid(token, EmailTokenPurpose.PASSWORD_RESET))) {
    return (
      <LinkProblem
        title="This link has expired"
        body={`Reset links are good for ${humanDuration(
          EMAIL_TOKEN_TTL_SECONDS.PASSWORD_RESET,
        )} and can only be used once. Request a fresh one and we'll send it straight over.`}
        actionHref="/forgot-password"
        actionLabel="Request a new link"
      />
    );
  }

  return (
    <div>
      <AuthHeading
        title="Choose a new password"
        subtitle="Pick something you haven't used here before."
      />
      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
