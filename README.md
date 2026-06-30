# Slipway — AI-first SaaS Boilerplate

**English** | [日本語](#slipway--ai-first-saas-ボイラープレート)

A Next.js SaaS starter built to be developed *with* AI. Most boilerplates give
you code; Slipway also gives you the **Claude Code workspace** — a `CLAUDE.md`
that teaches the architecture, agents that review and build to the house
style, and slash commands for the repetitive work. Your AI pair programmer is
productive from the very first prompt.

A slipway is the ramp a ship launches from. That is the job of this repo:
get your product into the water fast.

## What's inside

- **Next.js 15** — App Router, React Server Components, Server Actions, Turbopack
- **Auth.js v5 (NextAuth)** — email/password + optional Google OAuth, JWT sessions, two-layer route protection
- **Prisma 6 + SQLite** — zero-config local dev; swap the provider line and DATABASE_URL for Postgres in production
- **Tailwind CSS v4** — landing page (hero / features / FAQ) and a dashboard shell with settings
- **TypeScript strict mode** — `npm run build`, `npm run lint`, and `npx tsc --noEmit` all pass clean
- **Claude Code workspace** — `CLAUDE.md`, 3 agents, 3 slash commands, sane permissions (see below)

## Quick start

Requirements: Node.js 20+.

```bash
git clone <repo-url> my-app && cd my-app
npm install
cp .env.example .env
# set AUTH_SECRET in .env — generate one with: openssl rand -base64 32
npx prisma db push            # creates the local SQLite db
npm run dev
```

Open http://localhost:3000 — email/password signup works immediately, no
external services required. From clone to a signed-in dashboard in well under
30 minutes (typically under 5).

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
| `agents/code-reviewer` | Reviews diffs for auth, validation, and Next.js 15 pitfalls before you commit |
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

1. Switch `prisma/schema.prisma` datasource to `postgresql`, set
   `DATABASE_URL`, and run `npx prisma migrate dev` to create real migrations.
2. Set `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, and (optionally) the Google OAuth
   vars on your host. Vercel works out of the box.
3. Add your production domain to the Google OAuth client redirect URIs.

## Known limitations (deliberate scope cuts)

- No email verification or password reset flow (requires an email provider —
  Resend/Postmark is the natural next step).
- No automated tests included.
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

- **Next.js 15** — App Router、React Server Components、Server Actions、Turbopack
- **Auth.js v5 (NextAuth)** — メール/パスワード + Google OAuth(任意)、JWT セッション、二層のルート保護
- **Prisma 6 + SQLite** — 設定不要のローカル開発。本番は provider 1行と DATABASE_URL の変更で Postgres へ
- **Tailwind CSS v4** — ランディングページ(ヒーロー / 機能 / FAQ)と設定ページ付きダッシュボード
- **TypeScript strict モード** — `npm run build` / `npm run lint` / `npx tsc --noEmit` すべてクリーン
- **Claude Code ワークスペース** — `CLAUDE.md`、エージェント3体、スラッシュコマンド3個、適切な権限設定

## クイックスタート

必要環境: Node.js 20+

```bash
git clone <repo-url> my-app && cd my-app
npm install
cp .env.example .env
# .env の AUTH_SECRET を設定 — 生成コマンド: openssl rand -base64 32
npx prisma db push            # ローカル SQLite DB を作成
npm run dev
```

http://localhost:3000 を開けば、メール/パスワードでのサインアップが外部サー
ビスなしで即座に動きます。クローンからダッシュボードへのログインまで30分以内
(通常は5分以内)。

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
| `agents/code-reviewer` | コミット前に認証・バリデーション・Next.js 15 の落とし穴をレビュー |
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

1. `prisma/schema.prisma` の datasource を `postgresql` に変更し、
   `DATABASE_URL` を設定、`npx prisma migrate dev` で正式なマイグレーションを作成。
2. ホスティング先に `AUTH_SECRET`、`NEXT_PUBLIC_APP_URL`、(必要なら)Google
   OAuth の環境変数を設定。Vercel ならそのまま動きます。
3. Google OAuth クライアントのリダイレクト URI に本番ドメインを追加。

## 既知の制限(意図的なスコープ)

- メール認証・パスワードリセットなし(メールプロバイダが必要 — Resend /
  Postmark の導入が自然な次の一歩)。
- 自動テストは含まれません。
- ダッシュボード概要の統計はプレースホルダー。

## ライセンス

[MIT](./LICENSE) © 2026 skipbit
