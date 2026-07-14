import { defineConfig, devices } from "@playwright/test";

// Smoke e2e for the public pages (landing + auth). These routes never touch the
// database, so a syntactically valid dummy DATABASE_URL is enough and no
// Postgres service is required — same trick the CI build job uses.
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Fail the CI run if a `.only` was committed by mistake.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Dev server, so a Postgres-free smoke run needs no production build (the CI
    // `verify` job already builds). Locally this reuses an already-running
    // server (e.g. `docker compose up`) on :3000. AUTH_SECRET is a throwaway —
    // the auth() call on the login/signup pages needs one even when anonymous.
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://ci:ci@localhost:5432/ci?schema=public",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-dummy-secret-not-for-production",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
