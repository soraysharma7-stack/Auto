# Verification strategy

A feature is not considered release-verified because its page renders. Behavior, failure modes and
security boundaries need their own checks.

## Commands and current local evidence

| Layer | Command | Current coverage |
| --- | --- | --- |
| Static rules | `npm run lint` | Next.js, React and TypeScript source, including companion UI |
| Type safety | `npm run typecheck` | Strict web/server/tests TypeScript |
| Unit contracts | `npm test` | 29 tests across navigation, provider adapters, routing/context, encryption, validation, ownership, transitions, sandbox/device paths and API boundaries |
| Web production build | `npm run build` | Next.js compilation, type validation and route generation |
| PostgreSQL integration | `npm run test:database` | 33 assertions against temporary PostgreSQL 18: migrations, RLS, grants, rate limits, queue transitions, approvals and lease recovery |
| Browser behavior | `npm run test:e2e` | 16 Chromium tests: all routes, setup honesty, no fake composer, API setup error, mobile navigation and themes |
| Companion UI build | `npm run build --prefix desktop-agent` | React TypeScript and Vite production compilation |
| Database security | `npm run db:test` | pgTAP source for two-user RLS, execution-write denial and secret/rate-limit grant denial |
| Native compilation | GitHub Actions Windows job | Tauri/Rust compile on `windows-latest`; requires CI execution |

Web lint/type/unit/build/browser checks, the companion UI build and the portable PostgreSQL
integration suite have run successfully in the development sandbox. The database harness supplies
only the Supabase-compatible auth roles/UID helper needed by the migrations; it is not a managed
Supabase stack. **The pgTAP suite has not been executed here. Rust/Windows compilation, native OS
actions and real Docker sandbox execution have not run locally.** A future CI run is evidence
only after its result is inspected.

Playwright starts Next.js when needed. Install Chromium with
`npx playwright install --with-deps chromium` on a normal development machine. CI uses Ubuntu for
web checks and Windows for the companion.

## Required integration/security suites

### Accounts and data

With a disposable local Supabase stack, run `npm run db:reset` and `npm run db:test`. Extend the
suite whenever a table/policy changes. Verify same-user reads/writes and User B denial for every
owned domain, direct execution-table writes, secret grants, expired pairing and account deletion.
Add authenticated API integration tests against test identities before release.

### Providers and worker

Mocked unit tests cover normal responses, malformed success bodies and non-retryable auth errors.
A secret-protected live smoke environment must additionally exercise timeouts, cancellation,
quota/rate-limit responses and permitted fallback. Never place live keys in fixtures or Git.

Worker acceptance requires an actual database: concurrent claim attempts, process death during a
lease, retry history, cancellation, approval expiry and model-budget exhaustion. Queue behavior
cannot be proven by the pure transition tests alone.

### Tools and devices

Run Docker tests on the intended isolated worker host and verify no-network, resource limits,
workspace containment and disabled-by-default behavior. On Windows, compile the companion and
test expired/wrong pairing codes, OS credential storage, active-session visibility, offline local
stop, remote stop/revoke, permission changes between queueing and execution, screen capture,
bounded file reads and mouse/keyboard actions in a disposable test environment.

## Release acceptance checklist

Local static/browser evidence:

- [x] Web application lints, typechecks, unit-tests and builds.
- [x] Companion React/TypeScript application builds.
- [x] All workspace routes render honestly without credentials.
- [x] Browser navigation and theme persistence pass without inspected console errors.
- [x] Provider keys are excluded from the explicit account-export query and client contracts.
- [x] Actual migrations, cross-user RLS/grants and 33 queue/security assertions pass on PostgreSQL 18.

Still required with real infrastructure:

- [ ] Supabase sign-up/callback/sign-in/sign-out/export/deletion pass.
- [ ] pgTAP and cross-user API tests pass against the deployed migration set.
- [ ] Real provider success/failure/fallback/cancellation and usage recording pass.
- [ ] Worker recovery, retries, approvals, cancellation and budgets pass against PostgreSQL.
- [ ] Docker build/test isolation passes on the intended worker host.
- [ ] Native Windows compilation, pairing, permission revocation and stop behavior pass.
- [ ] Production headers, HTTPS/auth redirects, proxy IP trust, logs and secret storage are reviewed.
- [ ] Windows installer is built, inspected and code-signed for distribution.

Until those boxes are checked, describe the corresponding source as implemented but not live
verified—not as production-proven.
