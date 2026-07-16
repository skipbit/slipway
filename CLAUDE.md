# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Slipway: an AI-first Next.js 16 SaaS boilerplate. Marketing landing page +
email/Google auth + protected dashboard. Postgres everywhere, run through
Docker Compose (local dev = `docker compose up` with hot reload; production =
the standalone image). This is the free (lite) edition — there is no billing
code in this repo.

## Commands

```bash
docker compose up      # Postgres + app (next dev, hot reload) on :3000 — the dev workflow
docker compose down    # stop the stack (add -v to also wipe the db volume)
npm run dev            # host-only dev server (Turbopack); needs a reachable Postgres
npm run build          # production build (also the fastest full type-check)
npm run lint           # eslint
npx prisma db push     # sync schema to Postgres (dev workflow, no migration files)
npx prisma generate    # regenerate client after schema changes
npx prisma studio      # browse the database
npx tsc --noEmit       # type-check without building
npm run test           # vitest unit tests (lib/) — fast, no browser or db
npm run test:e2e       # playwright smoke e2e over the public pages
```

Compose runs `prisma generate && prisma db push --accept-data-loss` on start, so
schema edits apply on the next `docker compose up` (the flag keeps it
non-interactive when a change would drop data — acceptable for dev). The app
container runs as the non-root `node` user. Production-like build:
`docker compose -f docker-compose.prod.yml up --build`.

Tests: **Vitest** for pure logic in `lib/` (`*.test.ts`, `node` env — mock
`next/headers` and `@/lib/prisma`) and **Playwright** for a Postgres-free smoke
run over the public pages (`e2e/*.spec.ts`). The suffixes keep the two runners
from picking up each other's files. Add unit tests next to the code they cover;
put browser flows under `e2e/`. Verify changes with
`npm run lint && npx tsc --noEmit && npm run test && npm run build` at minimum
(or run the `/preflight` command); run `npm run test:e2e` when you touch the
public pages (needs `npx playwright install chromium` once).

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
- **DB**: Prisma 7 + Postgres (provider `postgresql`), run via Docker Compose
  in dev and prod. Prisma 7 is Rust-engine-free: the connection URL lives in
  `prisma.config.ts` (not the schema `datasource`), the client is emitted by the
  new `prisma-client` generator into `lib/generated/prisma` (gitignored), and
  `lib/prisma.ts` connects through the **pg driver adapter** (`@prisma/adapter-pg`)
  — `new PrismaClient({ adapter })`. It also memoizes the client across hot
  reloads. Dev workflow uses `db push` (no migration files yet); adopt
  `prisma migrate` when you need a real migration history.
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

- `searchParams`/`params` in pages are **Promises** (Next 15+) — `await` them.
- next-auth is the v5 **beta** (`next-auth@beta`); v4 docs/APIs do not apply.
  Augmented session type (`session.user.id`) lives in `types/next-auth.d.ts`.
- zod is v4: use top-level `z.email()` (not the deprecated
  `z.string().email()`), and read `error.issues`, not `error.errors`.
- Redirects are exceptions: `signIn`/`redirect` throw — never swallow them
  with a broad try/catch (see the rethrow pattern in `app/(auth)/actions.ts`).
- Run `npx prisma generate` after editing `schema.prisma`, or the build
  fails with stale client types. The client generates into `lib/generated/prisma`
  (gitignored) — CI and the Docker builds run `prisma generate` before
  lint/typecheck/build, so a fresh checkout must too.
- Prisma 7 dropped `url` from the schema `datasource`; the connection string is
  in `prisma.config.ts` (`datasource.url = env("DATABASE_URL")`, with
  `import "dotenv/config"` so host CLI runs pick up `.env`). Don't add `url` back
  to `schema.prisma` — validation (`P1012`) will reject it.
- `.env` is gitignored and must stay that way; `.env.example` documents every
  variable. Never commit real keys.

## Workspace tooling

- Agents (`.claude/agents/`): `feature-builder` (end-to-end feature work),
  `code-reviewer` (run before committing auth/schema changes),
  `db-expert` (any Prisma schema change).
- Commands (`.claude/commands/`): `/new-page`, `/add-model`, `/preflight`.

## Current state / roadmap

Done: landing (hero/features/FAQ), email+Google auth, dashboard
(overview/settings), profile update, account deletion, auth rate limiting,
Vitest unit tests + a Playwright smoke suite.
Not done yet (good first tasks): email verification + password reset (needs
Resend or similar), real dashboard metrics, Postgres migrations, expanding e2e
into a DB-backed signup → dashboard flow.
