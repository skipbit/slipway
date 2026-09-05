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
- **Password reset** — single-use hashed tokens over email (Resend), rate limited and safe against account enumeration; with no mail credentials the link is logged to the console so the flow works on a fresh clone (refused in production, so a misconfigured deploy fails loudly instead of leaking tokens into a log)
- **Prisma 7 + Postgres** — Rust-free client via the pg driver adapter; one-command local stack via Docker Compose; the same containerized app + Postgres in production; versioned migrations committed under `prisma/migrations/`
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

Changing the schema? Create the migration from inside the running container —
no host Node required:

```bash
docker compose exec app npx prisma migrate dev --name add_projects
docker compose exec app npx prisma generate
```

The generated SQL lands in `prisma/migrations/` — commit it. Every later
`docker compose up`, and the production image, applies it with
`prisma migrate deploy`.

Upgrading a clone from before migrations landed? Its database has no
migration history, so `migrate deploy` stops with `P3005`. Wipe it and start
clean: `docker compose down -v`.

Prefer the host? With Node.js 22+ and the compose Postgres running
(`docker compose up db`), point `DATABASE_URL` at `localhost:5432` in `.env`,
then `npm install && npx prisma migrate deploy && npm run dev`.

To enable Google sign-in later, create OAuth credentials in the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(redirect URI: `http://localhost:3000/api/auth/callback/google`) and set
`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. The button enables itself.

Password reset works out of the box with no email account: leave
`RESEND_API_KEY` / `EMAIL_FROM` unset and the reset link is printed to the
server log (`docker compose logs -f app`) instead of being sent. Set both to
send real mail — and note the console fallback is refused when
`NODE_ENV=production`, so a deploy that forgets them fails loudly rather than
writing live tokens to your log aggregator.

## Working with Claude Code

This is the part other boilerplates don't ship:

| | What it does |
| --- | --- |
| `CLAUDE.md` | Teaches the AI the architecture, conventions, and gotchas of this codebase |
| `agents/feature-builder` | Implements multi-file features end to end, following the house style |
| `agents/code-reviewer` | Reviews diffs for auth, validation, and Next.js 16 pitfalls before you commit |
| `agents/db-expert` | Owns Prisma schema changes: edit → migrate → regenerate → fix fallout |
| `/new-page` | Scaffolds a protected dashboard page wired into the sidebar |
| `/add-model` | Adds a Prisma model with conventions and validation wired through |
| `/preflight` | Runs lint + types + build and reports before you ship |

Open the repo with [Claude Code](https://claude.com/claude-code) and try:
`/new-page projects — list the user's projects with a create form`.

## Project structure

```
app/
  (auth)/                  login / signup / password reset + server actions
  api/auth/[...nextauth]/  Auth.js route handler
  dashboard/               protected app shell: overview, settings
  page.tsx                 landing page (hero, features, FAQ)
components/                landing, auth, dashboard, ui primitives
lib/                       auth.ts, prisma.ts, email.ts, password-reset.ts, site.ts, ...
prisma/schema.prisma       User / Account / Session / VerificationToken / PasswordResetToken
prisma/migrations/         versioned migration SQL, applied on every start
proxy.ts                   cookie check for /dashboard (authoritative check in layout)
.claude/                   CLAUDE.md companion: agents, commands, settings
```

## Going to production

Set `APP_URL` to the real origin. `NEXT_PUBLIC_APP_URL` is inlined when the
image is built, so a prebuilt image would otherwise mail password reset links
pointing at `http://localhost:3000` — and nothing about that fails loudly.

The stack is already Postgres. Two paths:

- **Docker anywhere** — build the standalone image and run it against a managed
  Postgres. Verify the production build locally first:
  ```bash
  docker compose -f docker-compose.prod.yml up --build
  ```
  This applies pending migrations, then serves the slim `next start` (standalone)
  image on http://localhost:3000. Point `DATABASE_URL` at your real database
  and deploy the same image to Fly.io / Railway / Cloud Run / a VPS.
- **Vercel** — works out of the box; set `DATABASE_URL` (managed Postgres) plus
  the env vars below.

  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway&env=AUTH_SECRET,DATABASE_URL,NEXT_PUBLIC_APP_URL&envLink=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway%2Fblob%2Fmain%2F.env.example)

Then:

1. Set `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, and (optionally) the
   Google OAuth vars.
2. Add your production domain to the Google OAuth client redirect URIs.
3. Run `npx prisma migrate deploy` as part of your deploy step. The Docker
   path already does this in the `migrate` service; on Vercel, add it to the
   build command.

## Known limitations (deliberate scope cuts)

- No email verification yet. Password reset is in (`lib/password-reset.ts`);
  verification would reuse the same `lib/email.ts` seam.
- Sessions are JWTs, so a password reset cannot revoke a session cookie stolen
  beforehand — it stays valid until it expires. Closing that means a
  `passwordChangedAt` check on every request, which costs the "no DB hit per
  request" property JWTs were chosen for. `resetPasswordAction` spells out the
  trade-off.
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
- **パスワードリセット** — ハッシュ化した単回使用トークンをメールで送付(Resend)。レート制限付きで、アカウントの存在を漏らさない。メール未設定ならリンクをコンソールに出力するので clone 直後でも動く(本番では出力を拒否するので、設定漏れはログにトークンを撒かず明示的に失敗する)
- **Prisma 7 + Postgres** — pg ドライバアダプタ経由の Rust-free クライアント。Docker Compose で1コマンドのローカル環境。本番も同じコンテナ + Postgres。マイグレーション履歴は `prisma/migrations/` にコミット済み
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

スキーマを変更したら、起動中のコンテナの中でマイグレーションを作成します(ホ
ストに Node は不要):

```bash
docker compose exec app npx prisma migrate dev --name add_projects
docker compose exec app npx prisma generate
```

生成された SQL は `prisma/migrations/` に出力されます — コミットしてください。
以降の `docker compose up` と本番イメージが `prisma migrate deploy` で適用しま
す。

マイグレーション導入前のクローンを更新した場合、その DB にはマイグレーショ
ン履歴が無いため `migrate deploy` が `P3005` で停止します。`docker compose
down -v` で一度消してから起動してください。

ホストで直接動かしたい場合は、Node.js 22+ と compose の Postgres
(`docker compose up db`)を用意し、`.env` の `DATABASE_URL` を
`localhost:5432` に向けて `npm install && npx prisma migrate deploy && npm run dev`。

Google ログインを有効にするには、[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
で OAuth 認証情報を作成し(リダイレクト URI:
`http://localhost:3000/api/auth/callback/google`)、`AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` を設定してください。ボタンは自動で有効になります。

パスワードリセットはメールアカウント無しでもそのまま動きます。`RESEND_API_KEY` /
`EMAIL_FROM` を未設定のままにすると、リセットリンクは送信されずサーバーログ
(`docker compose logs -f app`)に出力されます。実際に送るなら両方を設定してください。
なお `NODE_ENV=production` ではこのコンソール出力を拒否するため、設定漏れのまま
デプロイしてもログに生トークンを撒かず、明示的に失敗します。

## Claude Code との開発

ここが他のボイラープレートにはない部分です:

| | 役割 |
| --- | --- |
| `CLAUDE.md` | このコードベースのアーキテクチャ・規約・落とし穴を AI に教える |
| `agents/feature-builder` | 複数ファイルにまたがる機能を設計規約に沿って一気通貫で実装 |
| `agents/code-reviewer` | コミット前に認証・バリデーション・Next.js 16 の落とし穴をレビュー |
| `agents/db-expert` | Prisma スキーマ変更を担当: 編集 → migrate → 再生成 → 影響箇所の修正 |
| `/new-page` | サイドバーに組み込まれた保護済みダッシュボードページを scaffold |
| `/add-model` | 規約とバリデーション込みで Prisma モデルを追加 |
| `/preflight` | lint + 型チェック + ビルドを実行して出荷前レポート |

[Claude Code](https://claude.com/claude-code) でリポジトリを開いて、
`/new-page projects — ユーザーのプロジェクト一覧と作成フォーム` を試してみて
ください。

## プロジェクト構成

```
app/
  (auth)/                  ログイン / サインアップ / パスワードリセット + Server Actions
  api/auth/[...nextauth]/  Auth.js ルートハンドラ
  dashboard/               保護されたアプリシェル: 概要、設定
  page.tsx                 ランディングページ(ヒーロー、機能、FAQ)
components/                landing、auth、dashboard、ui プリミティブ
lib/                       auth.ts、prisma.ts、email.ts、password-reset.ts、site.ts ほか
prisma/schema.prisma       User / Account / Session / VerificationToken / PasswordResetToken
prisma/migrations/         マイグレーション SQL — 起動時に自動適用
proxy.ts                   /dashboard の Cookie チェック(正式な検証は layout 側)
.claude/                   CLAUDE.md と対になる agents、commands、settings
```

## 本番運用へ

`APP_URL` に実際のオリジンを設定してください。`NEXT_PUBLIC_APP_URL` はビルド時に
埋め込まれるため、ビルド済みイメージのままだとパスワードリセットのメールが
`http://localhost:3000` を指すリンクを送ってしまい、しかも何もエラーになりません。

スタックは既に Postgres。経路は2つ：

- **Docker でどこへでも** — standalone イメージをビルドし、マネージド Postgres
  に対して起動。まずローカルで本番ビルドを検証：
  ```bash
  docker compose -f docker-compose.prod.yml up --build
  ```
  保留中のマイグレーションを適用した後、スリムな standalone イメージが
  http://localhost:3000 で起動。
  `DATABASE_URL` を本番 DB に向ければ、同じイメージを Fly.io / Railway /
  Cloud Run / VPS へデプロイできます。
- **Vercel** — そのまま動作。`DATABASE_URL`(マネージド Postgres)と下記の環境
  変数を設定するだけ。

  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway&env=AUTH_SECRET,DATABASE_URL,NEXT_PUBLIC_APP_URL&envLink=https%3A%2F%2Fgithub.com%2Fskipbit%2Fslipway%2Fblob%2Fmain%2F.env.example)

その上で：

1. `AUTH_SECRET`、`NEXT_PUBLIC_APP_URL`、`DATABASE_URL`、(必要なら)Google OAuth
   の環境変数を設定。
2. Google OAuth クライアントのリダイレクト URI に本番ドメインを追加。
3. デプロイ手順に `npx prisma migrate deploy` を組み込む。Docker 経路は
   `migrate` サービスが既に実行済み。Vercel の場合はビルドコマンドに追加。

## 既知の制限(意図的なスコープ)

- メール認証は未実装。パスワードリセットは実装済み(`lib/password-reset.ts`)で、
  メール認証も同じ `lib/email.ts` の接合部を再利用できます。
- セッションが JWT のため、リセット前に盗まれたセッション Cookie はリセットでは
  失効せず、期限まで有効なままです。塞ぐには全リクエストで `passwordChangedAt` を
  照合する必要があり、JWT を選んだ理由である「リクエスト毎の DB アクセスなし」を
  失います。判断材料は `resetPasswordAction` のコメントに記載。
- テストは `lib/` ロジック(Vitest)と公開ページのスモーク(Playwright)をカバー。
  DB を伴うサインアップ → ダッシュボードの e2e フローはまだ未整備。
- ダッシュボード概要の統計はプレースホルダー。

## ライセンス

[MIT](./LICENSE) © 2026 skipbit
