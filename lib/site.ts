export const siteConfig = {
  name: "Slipway",
  description:
    "The AI-first SaaS boilerplate. Auth, dashboard, and database wired up — plus a Claude Code workspace that teaches AI your codebase from the first prompt.",
  // Build-time value: NEXT_PUBLIC_* is substituted by the bundler, so this is
  // frozen into the image. Fine for metadataBase; NOT fine for anything that
  // leaves the app — use externalUrl() for that.
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
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
