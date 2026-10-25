# Auto

Auto is a permission-first AI operations workspace. This repository contains **two separate
programs**: Auto Web (Next.js) and Auto Agent PC (Tauri + Rust). Browser access alone never
controls a computer.

> **Source status:** the integrated application, migrations, worker, tools and companion source
> are present. Web static checks, unit tests, 33 PostgreSQL integration assertions, production build and
> unconfigured-browser tests pass locally. Accounts, providers, tasks and devices require your own configured services. Live
> Supabase/RLS, Docker sandbox and native Windows verification are still required before release;
> see [docs/testing.md](docs/testing.md).

## Implemented behavior

- **Accounts and data:** Supabase email authentication, profiles, PostgreSQL migrations, RLS,
  ownership checks, audit history, account export and deletion.
- **AI Chat:** persisted conversations/messages, official Gemini, OpenAI and Anthropic API
  adapters, cancellation, normalized errors, usage events and no fabricated responses.
- **Routing:** verified-connection eligibility, user provider/model preference and priority,
  per-mode eligibility, declared context budgets, measured latency and recoverable fallback.
- **AI Team and Tasks:** configurable agents, durable queued tasks, an independent worker,
  attempt history, cancellation, retries, approvals and model-call budgets.
- **Tools:** official Tavily search, schema-validated workspace files and optional Docker-based
  build/test execution. No shell command is accepted from a model or browser.
- **Agent PC:** one-time pairing, hashed device tokens, visible sessions, local stop, revocable
  screen/input/folder permissions and execution-time permission checks in Rust.
- **Interface:** responsive desktop/mobile shell, light/dark/system themes, real loading/empty/
  error states and explicit **Not configured**, **Not checked**, **Queued** and offline states.

External services are never simulated. Without credentials, the application remains usable as an
honest setup interface rather than displaying demo accounts, AI replies, metrics or PC activity.

## Technology

| Area | Choice |
| --- | --- |
| Web/UI/API | Next.js 16, React 19, TypeScript 6, Tailwind CSS 4 |
| Accounts/data | Supabase Auth + PostgreSQL + Row Level Security |
| Validation/security | Zod, AES-256-GCM, SHA-256 token hashes, server-only modules |
| Worker/tools | TypeScript worker, official HTTPS APIs, optional Docker isolation |
| Windows companion | Tauri 2, Rust, React, OS credential store |
| Tests/CI | Vitest, Playwright, pgTAP, GitHub Actions (Ubuntu + Windows) |

## Run the web setup interface

Requires Node.js 22.12+ and npm.

```bash
npm ci
npm run dev
```

The server binds to `0.0.0.0:3000`. No credentials are needed to inspect the setup interface.
For real accounts and execution, copy `.env.example` to `.env.local`, configure Supabase and the
server-only keys, apply all migrations, and follow [docs/deployment.md](docs/deployment.md).
`npm run setup:check` reports environment presence only; it does not claim credentials are valid.

## Verify changes

```bash
npm run check                    # Lint + types + unit + PostgreSQL integration + production build
npm run test:database            # Temporary PostgreSQL 18; no Docker required
npx playwright install chromium  # One-time browser installation
npm run test:e2e                 # Real Chromium behavior

npm run build --prefix desktop-agent  # Companion React/TypeScript build

# With Docker and a local Supabase stack:
npm run db:start
npm run db:reset
npm run db:test                  # Two-user RLS and secret-grant tests
```

GitHub Actions runs web checks and compiles the native companion on `windows-latest`. Native OS
interaction, installer inspection and a paired-device smoke test still require a Windows machine.

## Source layout

```text
app/                     Next.js pages and authenticated API route handlers
components/              Feature interfaces, shared shell and UI primitives
lib/ai/                  Official providers, routing, prompts and contracts
lib/tasks/               Durable worker and agent execution
lib/tools/               Validated research/files/build/test tools and Docker isolation
lib/devices/             Device/session authorization and action contracts
lib/security/            Encryption, token hashing and persistent rate limits
scripts/                 Environment checks and standalone worker entry point
supabase/migrations/     Schema, RLS/grants and atomic queue/maintenance functions
supabase/tests/          pgTAP cross-user isolation tests
desktop-agent/           Independent Tauri + Rust Windows program
tests/                   Vitest and Playwright suites
docs/                    Architecture, security, deployment and verification
```

## Non-negotiable boundaries

1. Provider and service-role secrets never enter browser code or Git.
2. Every request is authenticated, validated and authorized server-side; RLS adds isolation.
3. Official APIs only—no cookie/password harvesting, session impersonation or quota bypass.
4. AI suggestions do not execute tools. Inputs, ownership, permissions and approvals are checked.
5. Terminal/administrator actions are not registered. The coding worker accepts only fixed
   build/test commands in an optional non-root Docker container.
6. Auto Agent PC is installed and controlled locally, shows active sessions, and checks stop and
   revocation before every action. Local stop works offline.
7. Long tasks run in the separate durable worker, not an unlimited serverless request.
8. Usage and costs are not invented. Provider API usage may be billable; chat subscriptions do
   not include API credits. Tasks have explicit model-call budgets and requests have rate limits.

Read [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md),
[docs/deployment.md](docs/deployment.md) and [docs/testing.md](docs/testing.md) before deploying.
