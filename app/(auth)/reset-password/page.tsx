import { type Metadata } from "next";
import Link from "next/link";
import { isPasswordResetTokenValid } from "@/lib/password-reset";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

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
 * not the threat either (256-bit tokens). If this route needs a cap, it belongs
 * at the edge, not in a per-request database round trip.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  // Next hands back an array whenever the key repeats — `?token=a&token=b`.
  // Typing this as `string` would be a lie that reaches createHash() and throws
  // ERR_INVALID_ARG_TYPE on a public route.
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const valid = token ? await isPasswordResetTokenValid(token) : false;

  if (!token || !valid) {
    // A link that arrived without a token was never valid — telling that
    // visitor their link "expired" sends them to request another one that
    // their mail client will mangle exactly the same way.
    return (
      <div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          {token ? "This link has expired" : "This link is incomplete"}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {token
            ? "Reset links are good for one hour and can only be used once. Request a fresh one and we'll send it straight over."
            : "This address is missing its reset token — some mail clients cut long links in half. Try copying the whole link from the email, or request a new one."}
        </p>

        <div className="mt-8 text-center">
          <Link
            href="/forgot-password"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
        Choose a new password
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Pick something you haven&apos;t used here before.
      </p>

      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
