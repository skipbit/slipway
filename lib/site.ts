export const siteConfig = {
  name: "Slipway",
  description:
    "The AI-first SaaS boilerplate. Auth, dashboard, and database wired up — plus a Claude Code workspace that teaches AI your codebase from the first prompt.",
  // Build-time value: NEXT_PUBLIC_* is substituted by the bundler, so this is
  // frozen into the image. Fine for metadataBase; NOT fine for anything that
  // leaves the app — use externalUrl() for that.
  // `||`, not `??`, for the same reason as externalUrl below: a build arg can
  // be present and empty (`--build-arg NEXT_PUBLIC_APP_URL=`), and "" is
  // non-nullish. Left as `??` this yields "", which makes externalUrl return a
  // relative link and `new URL(siteConfig.url)` in app/layout.tsx throw.
  url: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
};

/**
 * Absolute URL for links that leave the app — password reset emails, above all.
 *
 * `APP_URL` has no NEXT_PUBLIC_ prefix, so unlike `siteConfig.url` it stays a
 * real server-side lookup and can be set per deploy. This is the ONLY way to
 * build an outbound absolute URL; there is deliberately no second helper
 * reading the build-time value, because picking the wrong one mails links to
 * `http://localhost:3000` with nothing failing.
 *
 * `||`, not `??`: `.env.example` ships `APP_URL=""` and dotenv assigns the
 * empty string, which is non-nullish and would produce a relative link that no
 * mail client can open.
 */
export function externalUrl(path: string): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return `${configured || siteConfig.url}${path}`;
}

/**
 * The hint shown wherever Google sign-in is offered but not configured.
 *
 * One string, because it names two environment variables and the two places
 * that show it — the login button and the settings row — are exactly the two
 * places someone looks when wondering why they cannot use Google.
 */
export const GOOGLE_NOT_CONFIGURED =
  "Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in .env to enable";
