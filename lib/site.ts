export const siteConfig = {
  name: "Slipway",
  description:
    "The AI-first SaaS boilerplate. Auth, dashboard, and database wired up — plus a Claude Code workspace that teaches AI your codebase from the first prompt.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path}`;
}

/**
 * Absolute URL for links that leave the app — emails, above all.
 *
 * `NEXT_PUBLIC_APP_URL` is substituted by the bundler at BUILD time, so the
 * standalone image carries whatever it was built with (`http://localhost:3000`
 * by default) and would mail out links nobody can open. `APP_URL` has no
 * NEXT_PUBLIC_ prefix, so it stays a real server-side lookup and can be set per
 * deploy; it wins when present. Nothing fails loudly if you forget, which is
 * exactly why this is a separate function with this comment on it.
 */
export function externalUrl(path: string): string {
  const base = process.env.APP_URL?.replace(/\/+$/, "") ?? siteConfig.url;
  return `${base}${path}`;
}
