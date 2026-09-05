import { type Metadata } from "next";
import {
  RESET_TOKEN_TTL_SECONDS,
  isPasswordResetTokenValid,
} from "@/lib/password-reset";
import { firstParam } from "@/lib/utils";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { AuthHeading } from "@/components/ui/auth-heading";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = {
  title: "Choose a new password",
  // A URL that carries a live credential has no business in an index.
  robots: { index: false, follow: false },
};

/** The two ways a visitor arrives here without a usable link. */
function LinkProblem({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <AuthHeading title={title} subtitle={body} />
      <div className="mt-8 text-center">
        <TextLink href="/forgot-password">Request a new link</TextLink>
      </div>
    </div>
  );
}

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
 * not the threat either (256-bit tokens). If this route needs a cap, it belongs
 * at the edge, not in a per-request database round trip.
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
      />
    );
  }

  if (!(await isPasswordResetTokenValid(token))) {
    return (
      <LinkProblem
        title="This link has expired"
        body={`Reset links are good for ${Math.round(
          RESET_TOKEN_TTL_SECONDS / 60,
        )} minutes and can only be used once. Request a fresh one and we'll send it straight over.`}
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
