# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Slipway: an AI-first Next.js 15 SaaS boilerplate. Marketing landing page +
email/Google auth + protected dashboard. SQLite locally, designed to move to
Postgres in production. This is the free (lite) edition — there is no billing
code in this repo.

## Commands

```bash
npm run dev            # dev server (Turbopack) on :3000
npm run build          # production build (also the fastest full type-check)
npm run lint           # eslint
npx prisma db push     # sync schema to the local SQLite db (dev workflow)
npx prisma generate    # regenerate client after schema changes
npx prisma studio      # browse the database
npx tsc --noEmit       # type-check without building
```

There is no test suite in this edition. Verify changes with
`npm run build && npm run lint && npx tsc --noEmit` at minimum
(or run the `/preflight` command).

## Architecture

- **Auth**: `lib/auth.ts` exports `{ auth, signIn, signOut, handlers }` from
  Auth.js v5. JWT session strategy (required by the Credentials provider;
  also avoids a DB hit per request). PrismaAdapter persists users/accounts
  for Google OAuth. Email/password lives in the Credentials provider with
  bcryptjs hashes on `User.passwordHash`. Google sign-in enables itself when
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set (see `isGoogleConfigured`).
- **Route protection is two-layered**: `middleware.ts` does a *cookie
  presence* check only (fast, edge-safe, no Prisma). The authoritative
  `auth()` check is in `app/dashboard/layout.tsx`. Keep both when adding
  protected areas; never rely on middleware alone.
- **DB**: Prisma 6 + SQLite (`prisma/dev.db`). Dev workflow uses `db push`
  (no migration files yet). When switching to Postgres, change the
  datasource provider and start `prisma migrate dev`.
- **Branding** lives in `lib/site.ts` (`siteConfig`); never hardcode the
  product name in components.

## Conventions

- Server Components by default; add `"use client"` only for interactivity
  (forms with `useActionState`, `usePathname` nav).
- Mutations are Server Actions in a colocated `actions.ts` with `"use server"`
  at the top. Every action that touches user data must call `auth()` and
  scope Prisma queries by `session.user.id`.
- Validate all form input with zod schemas in `lib/validations.ts` before use.
- UI: Tailwind v4 utility classes, slate/indigo palette, primitives in
  `components/ui/`. `cn()` from `lib/utils.ts` for conditional classes.
  Dashboard cards: `rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200`.
- Path alias `@/*` from the repo root.

## Gotchas

- `searchParams`/`params` in pages are **Promises** (Next 15) — `await` them.
- next-auth is the v5 **beta** (`next-auth@beta`); v4 docs/APIs do not apply.
  Augmented session type (`session.user.id`) lives in `types/next-auth.d.ts`.
- zod is v4: use top-level `z.email()` (not the deprecated
  `z.string().email()`), and read `error.issues`, not `error.errors`.
- Redirects are exceptions: `signIn`/`redirect` throw — never swallow them
  with a broad try/catch (see the rethrow pattern in `app/(auth)/actions.ts`).
- Run `npx prisma generate` after editing `schema.prisma`, or the build
  fails with stale client types.
- `.env` is gitignored and must stay that way; `.env.example` documents every
  variable. Never commit real keys.

## Workspace tooling

- Agents (`.claude/agents/`): `feature-builder` (end-to-end feature work),
  `code-reviewer` (run before committing auth/schema changes),
  `db-expert` (any Prisma schema change).
- Commands (`.claude/commands/`): `/new-page`, `/add-model`, `/preflight`.

## Current state / roadmap

Done: landing (hero/features/FAQ), email+Google auth, dashboard
(overview/settings), profile update, account deletion.
Not done yet (good first tasks): email verification + password reset (needs
Resend or similar), real dashboard metrics, tests (Vitest + Playwright
recommended), Postgres migrations, rate limiting on auth actions.
