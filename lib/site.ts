export const siteConfig = {
  name: "Slipway",
  description:
    "The AI-first SaaS boilerplate. Auth, dashboard, and database wired up — plus a Claude Code workspace that teaches AI your codebase from the first prompt.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path}`;
}
