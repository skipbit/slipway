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
npx prisma migrate dev --name <change>   # create + apply a migration (dev)
npx prisma migrate deploy                # apply pending migrations (compose start, prod)
npx prisma generate    # regenerate client after schema changes
npx prisma studio      # browse the database
npx tsc --noEmit       # type-check without building
npm run test           # vitest unit tests (lib/) — fast, no browser or db
npm run test:e2e       # playwright smoke e2e over the public pages
```

Compose runs `prisma generate && prisma migrate deploy` on start, so a fresh
clone comes up with every committed migration already applied. Schema changes
are made from inside the running container (the host needs no Node):
`docker compose exec app npx prisma migrate dev --name add_projects`, then
`docker compose exec app npx prisma generate`. `migrate dev` writes
`prisma/migrations/<timestamp>_<name>/migration.sql` through the bind mount —
commit it. The app container runs as the non-root `node` user.
Production-like build: `docker compose -f docker-compose.prod.yml up --build`.

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
- **Email verification**: unconfirmed is a nudge, not a gate —
  `components/dashboard/verify-email-notice.tsx` on the overview and settings
  pages, with a per-user throttled resend. `/verify-email` spends the token on a
  button press, not on the GET, because mail scanners follow links. Google
  sign-ins arrive verified via the `linkAccount` event in `lib/auth.ts`, and a
  completed password reset verifies too (clicking a link we mailed there is what
  verification asks for). Gate on `user.emailVerified` where your product needs
  it; nothing here does.
- **Startup config check**: `instrumentation.ts` runs `productionConfigProblems()`
  (`lib/env.ts`) once per server start, so a production deploy missing `APP_URL`
  — or with only one half of `RESEND_API_KEY`/`EMAIL_FROM` — fails to boot
  instead of mailing links nobody can open. Email being unconfigured entirely
  stays legal: that is the documented console-fallback mode.
- **Mailed one-time links**: `lib/email-token.ts` covers both password reset
  and email verification — one `EmailToken` table with a `purpose` enum, because
  the two differ only in TTL and in what redeeming them does. EVERY statement
  matches on `purpose` as well as the hash; without that a confirmation link
  (which anyone gets by signing up) would be redeemable at `/reset-password`.
  It mints a 256-bit token, stores
  only its SHA-256, and redeems it exactly once (a single
  `DELETE ... WHERE "purpose" = $2 AND "expiresAt" > now() RETURNING "userId"`
  is the gate — one statement is the purpose check, the expiry check and the
  single-use lock). `lib/email.ts` sends it through Resend over plain `fetch` — and when
  `RESEND_API_KEY`/`EMAIL_FROM` are unset it logs the link instead, so the flow
  works on a fresh clone; that fallback throws under `NODE_ENV=production`
  rather than scattering live tokens through a log. The throw is caught by
  `requestPasswordResetAction` like any send failure, so it reaches the server
  log, not the user — enumeration safety outranks feedback here. Both actions
  live in `app/(auth)/actions.ts` and answer identically whether or not the
  account exists. Email links go through `externalUrl()` — see the
  build-time/runtime gotcha below.
- **Route protection is two-layered**: `proxy.ts` (the Next.js `proxy`
  convention, formerly `middleware.ts`) does a *cookie presence* check only
  (fast, edge-safe, no Prisma). The authoritative `auth()` check is in
  `app/dashboard/layout.tsx`. Keep both when adding protected areas; never
  rely on the proxy alone.
- **DB**: Prisma 7 + Postgres (provider `postgresql`), run via Docker Compose
  in dev and prod. Prisma 7's runtime client is Rust-engine-free (the CLI's
  schema-engine is still a native binary, statically linked against OpenSSL):
  the connection URL lives in `prisma.config.ts` (not the schema `datasource`),
  the client is emitted by the new `prisma-client` generator into
  `lib/generated/prisma` (gitignored), and
  `lib/prisma.ts` connects through the **pg driver adapter** (`@prisma/adapter-pg`)
  — `new PrismaClient({ adapter })`. It also memoizes the client across hot
  reloads. Schema changes go through `prisma migrate`: the migration SQL is
  committed under `prisma/migrations/`, and both compose stacks apply it with
  `migrate deploy` on start. `db push` is not part of the workflow.
- **Branding** lives in `lib/site.ts` (`siteConfig`); never hardcode the
  product name in components.

## Conventions

- Server Components by default; add `"use client"` only for interactivity
  (forms with `useActionState`, `usePathname` nav).
- Mutations are Server Actions in a colocated `actions.ts` with `"use server"`
  at the top. Every action that touches user data must call `auth()` and
  scope Prisma queries by `session.user.id`. The one deliberate exception is
  account recovery: `resetPasswordAction` has no session by definition, so the
  emailed token *is* the authorisation and the user id comes from redeeming it
  — never from the form. Any new exception needs the same shape: a single-use
  secret the server minted, and an id derived from it.
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
- `prisma migrate dev` does **not** regenerate the client in Prisma 7 despite
  what its `--help` says — run `npx prisma generate` after it, or the build
  fails on stale types.
- Editing `schema.prisma` without creating a migration leaves the DB behind:
  `migrate deploy` has nothing to apply and queries fail at runtime. CI's
  `migrations` job catches this.
- A database created by the old `db push` workflow has no migration history —
  `migrate deploy` stops with `P3005`. Wipe it: `docker compose down -v`.
- Don't run `npm run build` inside the compose **dev** container: its image
  sets `NODE_ENV=development` (Dockerfile `dev` stage), and `next build` under
  that fails prerendering `/_global-error` with a bare
  `TypeError: Cannot read properties of null (reading 'useContext')` that looks
  like a code bug and isn't. Use
  `docker compose run --rm -e NODE_ENV=production app npm run build`, or the
  `builder` stage via `docker-compose.prod.yml`.
- `NEXT_PUBLIC_*` is substituted at **build** time, so `siteConfig.url` is
  frozen into the image. Anything that leaves the app (password reset emails)
  must go through `externalUrl()` in `lib/site.ts`, which reads the
  runtime-only `APP_URL`; there is deliberately no second helper reading the
  build-time value, so don't add one back. `instrumentation.ts` refuses to
  start a production server without it. The `||`-not-`??` detail and why are on
  the function's docstring.
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
password reset and email verification (hashed single-use tokens + Resend, with
a console fallback),
Postgres migrations (prisma migrate), Vitest unit tests + a Playwright smoke
suite.
Not done yet (good first tasks): real dashboard metrics, expanding e2e into a
DB-backed signup → dashboard flow — which is also what `/reset-password` and
`/verify-email` need before they can be covered there, along with the dashboard's
verification notice. `LOGIN_LIMIT`/`SIGNUP_LIMIT` still collapse to one bucket
without a proxy in front (see `getClientIp`).
