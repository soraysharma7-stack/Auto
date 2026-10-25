# Deployment and configuration

Auto Web, its durable worker and Auto Agent PC are separate deployables. Do not assume a web
serverless function can run an indefinite task or a persistent desktop session.

## 1. Supabase

1. Create a Supabase project (or start the local stack with Docker).
2. Apply `supabase/migrations/001_core.sql`, `002_rls.sql` and `003_worker.sql` in order.
   With the CLI, `supabase db reset` performs a clean local apply; use reviewed migrations for an
   existing remote database rather than resetting it.
3. Enable email authentication and configure the production Site URL and `/auth/callback` redirect.
4. Run `npm run test:database` for the portable PostgreSQL compatibility/security suite and
   `supabase test db` against a disposable full Supabase stack. Never run destructive tests
   against production.
5. Keep the service-role key server-only. The browser receives only the public project URL and
   publishable/anon key; RLS remains mandatory even though application APIs use scoped checks.

## 2. Environment

Set these in the web host and, where needed, the worker host:

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Supabase project identifier |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Public Supabase client key, not authorization bypass |
| `NEXT_PUBLIC_APP_URL` | Web | Canonical HTTPS origin |
| `SUPABASE_SERVICE_ROLE_KEY` | Web + worker | Server-side owned operations; never expose publicly |
| `PROVIDER_ENCRYPTION_KEY` | Web + worker | 32-byte base64 AES key for provider credentials |
| `WORKER_SECRET` | Web | Bearer credential for authenticated manual worker ticks |
| `AUTO_SANDBOX_ENABLED` | Worker | Explicitly opt into Docker build/test execution |
| `AUTO_SANDBOX_ROOT` | Worker | Persistent per-task sandbox workspace root |
| `AUTO_SANDBOX_DOCKER_IMAGE` | Worker | Reviewed sandbox image; defaults to `node:22-alpine` |

Generate independent secrets with `openssl rand -base64 32` and a password manager. Never reuse a
provider key as an encryption key. Rotate a compromised service-role or encryption key according
to an incident plan; rotating only the encryption key makes existing encrypted provider keys
undecryptable until they are re-entered.

`npm run setup:check` loads `.env.local`/`.env` and reports presence, not validity. Production
environment variables should be supplied by the host's secret manager, not committed files.

## 3. Auto Web

Vercel is one possible Next.js host; another Node.js host can also run `npm run build` and
`npm start`. Set the production environment before building so the setup screen is not statically
prerendered into the deployment. Use HTTPS and configure Supabase Auth redirects to the same
canonical origin.

The application sets conservative security headers in `next.config.ts`. If deploying behind a
proxy, preserve the authenticated Supabase cookies and configure the proxy's real client-IP header
correctly. Pairing rate limits use the first `x-forwarded-for` address; direct origins that let a
client spoof that header must be blocked by the hosting layer.

No automatic cron or paid plan is enabled by this repository. A manually authorized
`POST /api/worker/tick` exists for controlled triggering, but it is not a replacement for a
continuous worker when tasks must run reliably.

## 4. Durable worker

Run `npm ci` and `npm run worker` on a persistent Node.js 22.12+ host with the server environment.
The worker polls every two seconds, claims tasks atomically in PostgreSQL, maintains attempt
history, expires stale work and stops after the current attempt on SIGINT/SIGTERM.

Run at least one worker for tasks to leave **Queued**. Multiple workers are supported by the
atomic claim function, but external API quota and cost remain your responsibility. Task model
budgets count fallback calls too. A task is failed honestly when its budget is exhausted.

For file and build/test tools, the worker host additionally needs Docker. Keep
`AUTO_SANDBOX_ENABLED=false` unless the host and Docker daemon are dedicated to this workload.
The runner uses a non-root user, no network, read-only root filesystem, a tmpfs `/tmp`, capped
memory/PIDs, dropped capabilities and fixed build/test commands. It is not a general-purpose
terminal. Mounting a host Docker socket into a web container is not recommended.

## 5. Auto Agent PC

Build and test on Windows using `desktop-agent/README.md`. Point the companion to the HTTPS Auto
Web origin, generate a short-lived pairing code while signed in, and pair on the PC. Grant only
required local permissions and folders.

The companion stores its high-entropy device token in the OS credential store and non-secret
configuration in the Tauri app-data directory. The server stores only a SHA-256 token hash.
Production builds must be code-signed before broad distribution; this repository does not provide
a signing certificate or a prebuilt installer.

## 6. Release gate

Before calling a deployment operational, verify with real but non-production test accounts:

- sign-up, callback, sign-in, sign-out, export and deletion;
- `supabase test db` and negative cross-user API tests;
- one real request per configured official provider, including failure/fallback and cancellation;
- queued task recovery after a worker restart, approval expiry, cancellation and budget exhaustion;
- sandbox execution on an isolated worker host;
- Windows pairing, wrong/expired code rejection, permission revocation, offline stop and session
  revocation during queued and active work;
- log review confirming provider keys, device tokens and message contents are not logged.

Keep live credentials out of CI unless a dedicated secret-protected smoke-test workflow is added.
Do not infer a successful integration from a successful TypeScript build.
