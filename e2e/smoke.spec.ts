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

test("forgot-password page links back to login", async ({ page }) => {
  await page.goto("/forgot-password");

  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
