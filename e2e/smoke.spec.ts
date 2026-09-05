import { expect, test } from "@playwright/test";

// Smoke coverage for the unauthenticated surface: the pages render and the
// links between them work. Extend this file with a DB-backed signup → dashboard
// flow once the CI job provisions a Postgres service.
//
// /reset-password is deliberately absent: it validates the token against
// Postgres on GET, and this job runs with a dummy DATABASE_URL. It belongs in
// the same DB-backed suite as the signup flow.

test("landing page renders the hero and primary CTAs", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /Ship your SaaS/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try the live demo" }),
  ).toBeVisible();
});

test("login page renders and links to signup", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();

  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
});

test("signup page renders its fields and links back to login", async ({
  page,
}) => {
  await page.goto("/signup");

  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("password recovery is reachable from login and absent from signup", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Forgot your password?" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeVisible();

  // The link is login-only — on signup there is no account to recover yet.
  await page.goto("/signup");
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toHaveCount(0);
});

test("login explains an OAuth error instead of showing a code", async ({
  page,
}) => {
  // Auth.js sends failures to /login (pages.error). The one that actually
  // happens is a Google address that already belongs to an account, because
  // linking is only allowed from a signed-in session.
  // Matched on text, not role: Next's dev route announcer is also role=alert.
  await page.goto("/login?error=OAuthAccountNotLinked");
  await expect(
    page.getByText("An account with that email address already exists"),
  ).toBeVisible();
  await expect(page.getByText("connect Google from Settings")).toBeVisible();

  // The fallback is shared with the settings page, so it cannot say "signing
  // you in" — that is wrong for someone who is already signed in and was
  // connecting a provider.
  await page.goto("/login?error=SomethingNobodyHasHeardOf");
  await expect(page.getByText("Something went wrong")).toBeVisible();

  // An inherited property is not a message: `?error=constructor` used to hand
  // React a function.
  await page.goto("/login?error=constructor");
  await expect(page.getByText("Something went wrong")).toBeVisible();
});

test("forgot-password page links back to login", async ({ page }) => {
  await page.goto("/forgot-password");

  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
