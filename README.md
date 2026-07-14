# Slipway — AI-first SaaS Boilerplate

[![CI](https://github.com/skipbit/slipway/actions/workflows/pr-check.yml/badge.svg?branch=main)](https://github.com/skipbit/slipway/actions/workflows/pr-check.yml)
[![License: MIT](https://img.shields.io/github/license/skipbit/slipway)](./LICENSE)
[![README: English | 日本語](https://img.shields.io/badge/README-English%20%7C%20%E6%97%A5%E6%9C%AC%E8%AA%9E-blue)](#slipway--ai-first-saas-ボイラープレート)

[![Next.js](https://img.shields.io/github/package-json/dependency-version/skipbit/slipway/next?label=Next.js&logo=nextdotjs&logoColor=white&color=black)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](./tsconfig.json)
[![Prisma](https://img.shields.io/github/package-json/dependency-version/skipbit/slipway/dev/prisma?label=Prisma&logo=prisma&logoColor=white&color=2D3748)](./prisma/schema.prisma)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](./docker-compose.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](./.nvmrc)

**English** | [日本語](#slipway--ai-first-saas-ボイラープレート)

A Next.js SaaS starter built to be developed *with* AI. Most boilerplates give
you code; Slipway also gives you the **Claude Code workspace** — a `CLAUDE.md`
that teaches the architecture, agents that review and build to the house
style, and slash commands for the repetitive work. Your AI pair programmer is
productive from the very first prompt.

A slipway is the ramp a ship launches from. That is the job of this repo:
get your product into the water fast.

## What's inside

- **Next.js 16** — App Router, React Server Components, Server Actions, Turbopack
- **Auth.js v5 (NextAuth)** — email/password + optional Google OAuth, JWT sessions, two-layer route protection
- **Prisma 6 + Postgres** — one-command local stack via Docker Compose; the same containerized app + Postgres in production
- **Tailwind CSS v4** — landing page (hero / features / FAQ) and a dashboard shell with settings
- **TypeScript strict mode** — `npm run build`, `npm run lint`, and `npx tsc --noEmit` all pass clean
- **Tested** — Vitest unit tests over the `lib/` logic + a Playwright smoke suite for the public pages, both wired into CI
- **Claude Code workspace** — `CLAUDE.md`, 3 agents, 3 slash commands, sane permissions (see below)

## Quick start

Requirements: Docker (with Compose). No local Node or Postgres needed.

```bash
git clone <repo-url> my-app && cd my-app
cp .env.example .env
# set AUTH_SECRET in .env — generate one with: openssl rand -base64 32
docker compose up             # Postgres + the app with hot reload
```

Open http://localhost:3000 — email/password signup works immediately, no
external services required. Edits reload live. From clone to a signed-in
dashboard in well under 30 minutes (typically under 5).

Prefer the host? With Node.js 22+ and the compose Postgres running
(`docker compose up db`), point `DATABASE_URL` at `localhost:5432` in `.env`,
then `npm install && npx prisma db push && npm run dev`.

To enable Google sign-in later, create OAuth credentials in the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(redirect URI: `http://localhost:3000/api/auth/callback/google`) and set
`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. The button enables itself.

## Working with Claude Code

This is the part other boilerplates don't ship:

| | What it does |
| --- | --- |
| `CLAUDE.md` | Teaches the AI the architecture, conventions, and gotchas of this codebase |
| `agents/feature-builder` | Implements multi-file features end to end, following the house style |
| `agents/code-reviewer` | Reviews diffs for auth, validation, and Next.js 16 pitfalls before you commit |
| `agents/db-expert` | Owns Prisma schema changes: edit → push → regenerate → fix fallout |
| `/new-page` | Scaffolds a protected dashboard page wired into the sidebar |
| `/add-model` | Adds a Prisma model with conventions and validation wired through |
| `/preflight` | Runs lint + types + build and reports before you ship |

Open the repo with [Claude Code](https://claude.com/claude-code) and try:
`/new-page projects — list the user's projects with a create form`.

## Project structure

```
app/
  (auth)/                  login & signup pages + server actions
  api/auth/[...nextauth]/  Auth.js route handler
  dashboard/               protected app shell: overview, settings
  page.tsx                 landing page (hero, features, FAQ)
components/                landing, auth, dashboard, ui primitives
lib/                       auth.ts, prisma.ts, site.ts, validations.ts, utils.ts
prisma/schema.prisma       User / Account / Session / VerificationToken
middleware.ts              cookie check for /dashboard (authoritative check in layout)
.claude/                   CLAUDE.md companion: agents, commands, settings
```

## Going to production

The stack is already Postgres. Two paths:

- **Docker anywhere** — build the standalone image and run it against a managed
  Postgres. Verify the production build locally first:
  ```bash
  docker compose -f docker-compose.prod.yml up --build
  ```
  This runs the schema push, then serves the slim `next start` (standalone)
  image on http://localhost:3000. Point `DATABASE_URL` at your real database
  and deploy the same image to Fly.io / Railway / Cloud Run / a VPS.
- **Vercel** — works out of the box; set `DATABASE_URL` (managed Postgres) plus
  the env vars below.

  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway&env=AUTH_SECRET,DATABASE_URL,NEXT_PUBLIC_APP_URL&envLink=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway%2Fblob%2Fmain%2F.env.example)

Then:

1. Set `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, and (optionally) the
   Google OAuth vars.
2. Add your production domain to the Google OAuth client redirect URIs.
3. For a real migration history, adopt `prisma migrate` (`migrate dev` locally,
   `migrate deploy` in the container) instead of the `db push` default.

## Known limitations (deliberate scope cuts)

- No email verification or password reset flow (requires an email provider —
  Resend/Postmark is the natural next step).
- Tests cover `lib/` logic (Vitest) and a public-page smoke run (Playwright);
  there is no DB-backed signup → dashboard e2e flow yet.
- Placeholder stats on the dashboard overview.

## License

[MIT](./LICENSE) © 2026 skipbit

---

# Slipway — AI-first SaaS ボイラープレート

[English](#slipway--ai-first-saas-boilerplate) | **日本語**

AI と一緒に開発することを前提に設計された Next.js SaaS スターターです。多く
のボイラープレートはコードだけを提供しますが、Slipway は **Claude Code ワー
クスペース**も同梱しています — アーキテクチャを AI に教える `CLAUDE.md`、設
計規約に沿ってレビュー・実装するエージェント、繰り返し作業のためのスラッシュ
コマンド。AI ペアプログラマーが最初のプロンプトから戦力になります。

Slipway(進水台)は船を水に降ろすための斜路のこと。このリポジトリの役割もそ
れと同じ — あなたのプロダクトを最速で水に浮かべることです。

## 含まれるもの

- **Next.js 16** — App Router、React Server Components、Server Actions、Turbopack
- **Auth.js v5 (NextAuth)** — メール/パスワード + Google OAuth(任意)、JWT セッション、二層のルート保護
- **Prisma 6 + Postgres** — Docker Compose で1コマンドのローカル環境。本番も同じコンテナ + Postgres
- **Tailwind CSS v4** — ランディングページ(ヒーロー / 機能 / FAQ)と設定ページ付きダッシュボード
- **TypeScript strict モード** — `npm run build` / `npm run lint` / `npx tsc --noEmit` すべてクリーン
- **テスト付き** — `lib/` ロジックの Vitest 単体テスト + 公開ページの Playwright スモークテスト。どちらも CI に組み込み済み
- **Claude Code ワークスペース** — `CLAUDE.md`、エージェント3体、スラッシュコマンド3個、適切な権限設定

## クイックスタート

必要環境: Docker(Compose 同梱)。ローカルの Node や Postgres は不要。

```bash
git clone <repo-url> my-app && cd my-app
cp .env.example .env
# .env の AUTH_SECRET を設定 — 生成コマンド: openssl rand -base64 32
docker compose up             # Postgres とアプリをホットリロードで起動
```

http://localhost:3000 を開けば、メール/パスワードでのサインアップが外部サー
ビスなしで即座に動きます。ファイル編集は即座に反映されます。クローンからダッ
シュボードへのログインまで30分以内(通常は5分以内)。

ホストで直接動かしたい場合は、Node.js 22+ と compose の Postgres
(`docker compose up db`)を用意し、`.env` の `DATABASE_URL` を
`localhost:5432` に向けて `npm install && npx prisma db push && npm run dev`。

Google ログインを有効にするには、[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
で OAuth 認証情報を作成し(リダイレクト URI:
`http://localhost:3000/api/auth/callback/google`)、`AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` を設定してください。ボタンは自動で有効になります。

## Claude Code との開発

ここが他のボイラープレートにはない部分です:

| | 役割 |
| --- | --- |
| `CLAUDE.md` | このコードベースのアーキテクチャ・規約・落とし穴を AI に教える |
| `agents/feature-builder` | 複数ファイルにまたがる機能を設計規約に沿って一気通貫で実装 |
| `agents/code-reviewer` | コミット前に認証・バリデーション・Next.js 16 の落とし穴をレビュー |
| `agents/db-expert` | Prisma スキーマ変更を担当: 編集 → push → 再生成 → 影響箇所の修正 |
| `/new-page` | サイドバーに組み込まれた保護済みダッシュボードページを scaffold |
| `/add-model` | 規約とバリデーション込みで Prisma モデルを追加 |
| `/preflight` | lint + 型チェック + ビルドを実行して出荷前レポート |

[Claude Code](https://claude.com/claude-code) でリポジトリを開いて、
`/new-page projects — ユーザーのプロジェクト一覧と作成フォーム` を試してみて
ください。

## プロジェクト構成

```
app/
  (auth)/                  ログイン・サインアップページ + Server Actions
  api/auth/[...nextauth]/  Auth.js ルートハンドラ
  dashboard/               保護されたアプリシェル: 概要、設定
  page.tsx                 ランディングページ(ヒーロー、機能、FAQ)
components/                landing、auth、dashboard、ui プリミティブ
lib/                       auth.ts、prisma.ts、site.ts、validations.ts、utils.ts
prisma/schema.prisma       User / Account / Session / VerificationToken
middleware.ts              /dashboard の Cookie チェック(正式な検証は layout 側)
.claude/                   CLAUDE.md と対になる agents、commands、settings
```

## 本番運用へ

スタックは既に Postgres。経路は2つ：

- **Docker でどこへでも** — standalone イメージをビルドし、マネージド Postgres
  に対して起動。まずローカルで本番ビルドを検証：
  ```bash
  docker compose -f docker-compose.prod.yml up --build
  ```
  スキーマ適用の後、スリムな standalone イメージが http://localhost:3000 で起動。
  `DATABASE_URL` を本番 DB に向ければ、同じイメージを Fly.io / Railway /
  Cloud Run / VPS へデプロイできます。
- **Vercel** — そのまま動作。`DATABASE_URL`(マネージド Postgres)と下記の環境
  変数を設定するだけ。

  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway&env=AUTH_SECRET,DATABASE_URL,NEXT_PUBLIC_APP_URL&envLink=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway%2Fblob%2Fmain%2F.env.example)

その上で：

1. `AUTH_SECRET`、`NEXT_PUBLIC_APP_URL`、`DATABASE_URL`、(必要なら)Google OAuth
   の環境変数を設定。
2. Google OAuth クライアントのリダイレクト URI に本番ドメインを追加。
3. 正式なマイグレーション履歴が欲しい場合は、既定の `db push` に代えて
   `prisma migrate`(ローカルは `migrate dev`、コンテナは `migrate deploy`)を採用。

## 既知の制限(意図的なスコープ)

- メール認証・パスワードリセットなし(メールプロバイダが必要 — Resend /
  Postmark の導入が自然な次の一歩)。
- テストは `lib/` ロジック(Vitest)と公開ページのスモーク(Playwright)をカバー。
  DB を伴うサインアップ → ダッシュボードの e2e フローはまだ未整備。
- ダッシュボード概要の統計はプレースホルダー。

## ライセンス

[MIT](./LICENSE) © 2026 skipbit
