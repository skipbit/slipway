import { AuthHeading } from "@/components/ui/auth-heading";
import { TextLink } from "@/components/ui/text-link";

/**
 * The dead-end an emailed link can land on: it arrived without its token, or
 * the token is spent or past its expiry. Shared by /reset-password and
 * /verify-email because the shape is identical and the difference is words.
 */
export function LinkProblem({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div>
      <AuthHeading title={title} subtitle={body} />
      <div className="mt-8 text-center">
        <TextLink href={actionHref}>{actionLabel}</TextLink>
      </div>
    </div>
  );
}
