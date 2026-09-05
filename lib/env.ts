// Production configuration that nothing downstream can catch in time.
//
// Both checks here are for states that are ALWAYS a mistake, and both used to
// be defended by prose: the README explained at length that a misconfigured
// deploy mails links nobody can open, and docker-compose.prod.yml was the only
// thing enforcing it — so every other deploy path (Vercel, Fly, k8s, a plain
// `docker run`) went unguarded. A check that runs once at startup is the right
// altitude for a fact that is knowable at startup.
//
// Deliberately NOT checked: email being unconfigured altogether. That is a
// supported state — the README documents password reset working with the link
// logged to the console — so failing to boot on it would be a behaviour change,
// not a fix. `sendPasswordResetEmail` already refuses to log a live token in
// production.

type Env = Record<string, string | undefined>;

/**
 * Both halves present and non-blank.
 *
 * The single definition, shared with lib/email.ts. Two of them drifted once
 * already: raw truthiness here and `.trim()` there meant a whitespace-only
 * RESEND_API_KEY read as configured in one place and unset in the other, so
 * the server booted happily and then sent `Authorization: Bearer    `.
 */
export function isEmailConfigured(env: Env = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

/** Everything wrong with `env`, as sentences an operator can act on. */
export function productionConfigProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];

  const problems: string[] = [];
  const appUrl = env.APP_URL?.trim();

  if (!appUrl) {
    problems.push(
      "APP_URL is unset. It is the origin password reset emails link to, and " +
        "without it they fall back to the build-time NEXT_PUBLIC_APP_URL — " +
        "usually http://localhost:3000, which no recipient can open.",
    );
  } else if (!isAbsoluteHttpUrl(appUrl)) {
    problems.push(
      `APP_URL is not an absolute http(s) URL (got ${JSON.stringify(appUrl)}).`,
    );
  }

  const hasKey = Boolean(env.RESEND_API_KEY?.trim());
  const hasFrom = Boolean(env.EMAIL_FROM?.trim());
  // Both unset is legal — see the note at the top of this file.
  if (hasKey !== hasFrom) {
    problems.push(
      `RESEND_API_KEY and EMAIL_FROM must be set together (${
        hasKey ? "EMAIL_FROM" : "RESEND_API_KEY"
      } is missing). Half-configured, the console fallback switches off and ` +
        "every send fails at the provider, which the user never sees.",
    );
  }

  return problems;
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
