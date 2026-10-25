# Auto architecture

## 1. Programs and trust boundaries

Auto contains two programs:

- **Auto Web**: the Next.js browser interface, server APIs, Supabase data access and official
  provider adapters.
- **Auto Agent PC**: the independent Tauri + Rust Windows companion. It performs only actions
  authorized by a paired device, visible active session and local permission.

```text
Browser
   │ HTTPS + Supabase auth cookies
   ▼
Next.js request proxy (session refresh)
   ├── Workspace pages and server API validation/authorization
   ├── Supabase Auth + PostgreSQL + RLS
   ├── Official provider APIs
   └── Atomic task queue ◄── Separate durable worker ── Official tools / optional Docker

Paired Windows companion ── 3-second authenticated action poll ── Device APIs
   └── Visible session + local stop + execution-time Rust permission checks
```

The browser never has direct OS access. An offline, unpaired, stopped or revoked companion is not
represented as controllable.

## 2. Web request sequence

`app/(workspace)` supplies the authenticated product shell; `app/(auth)` handles account access.
`proxy.ts` refreshes Supabase cookies in a runtime that can write them. Route Handlers then:

1. reject unconfigured services honestly or authenticate the caller;
2. validate JSON, route parameters, lengths and enums;
3. scope every query/mutation to the authenticated owner;
4. check rate limits, provider state, task budget, approval or device permission as appropriate;
5. execute a narrow server-side operation and record permitted usage/audit metadata;
6. return only the fields required by the interface.

Client validation is convenience only. Server APIs use the service-role client where necessary,
but still add explicit owner predicates; RLS protects direct browser/anon access independently.

## 3. Data model

| Domain | Records |
| --- | --- |
| Identity | `profiles` |
| Agents | `agents` with provider/model preference, instructions, tool allowlist and limits |
| Conversation | `conversations`, `messages` |
| Execution | `tasks`, `agent_runs`, `tool_approvals` |
| Integrations | `provider_connections`, isolated `provider_connection_secrets`, `usage_events` |
| Accountability | `audit_logs`, `rate_limits` |
| Local control | `devices`, pairing codes, permissions, sessions and actions |

Every user-owned table has an owner and RLS. Browser roles can manage only configuration/data
that is safe to mutate directly; execution, secrets, usage and audit internals are service-only.
The pgTAP suite uses two auth identities for a full Supabase stack. A separate portable
PostgreSQL 18 harness applies the real migrations and runs 38 RLS/grant/rate-limit/queue assertions
in local checks and CI.

Conversation memory is the recent non-failed message context deliberately sent with a request.
There is no hidden embedding/vector memory. Whole older messages are omitted when needed to fit a
connection's declared context limit; the latest request and system instructions are never silently
truncated.

## 4. Provider routing

Official adapters normalize Gemini, OpenAI and Anthropic text responses, token usage, timeouts,
HTTP failures and malformed responses. Only verified AI connections are eligible. Routing uses:

- mode eligibility configured on the connection;
- preferred provider/model and user priority;
- measured request latency as a tie-breaker;
- declared context capacity and output-token reservation.

Only recoverable provider failures fall back. Authentication errors, malformed responses and
caller cancellation stop the chain. Every attempted provider call, including fallback and
failure, creates a usage event. Chat and task creation have persistent request limits; tasks also
have a total model-attempt budget. Token/cost fields remain unknown when a provider does not
report them.

## 5. Durable execution

Task creation writes **Queued**, not a fabricated running state. The standalone worker claims one
task through an atomic PostgreSQL function, sets a five-minute lease and creates a new run attempt. The agent
loop uses the configured instructions, allowlist, mode and provider policy. Valid transitions are:

```text
queued → running → completed / failed / cancelled
                 ↔ waiting_approval
failed / cancelled → queued (explicit retry)
```

A retry creates another attempt rather than erasing history. Lease heartbeats and expiration maintenance requeue crashed work for up to three attempts before
failing it. Atomic transition functions prevent stale completion, failure and approval decisions
from overwriting cancellation. Maintenance also expires approvals and invalidates expired
sessions/actions. The worker is not part of a serverless page request.

## 6. Tools and sandboxes

An AI suggestion has no execution authority. Tool dispatch checks the agent allowlist, validates
input again and uses approvals where configured. Research uses official Tavily APIs. Workspace
files are contained beneath a task-specific root. Optional build/test tools accept only fixed
commands and run in a non-root, no-network Docker container with resource limits. Disabled Docker
or an unavailable tool produces an error, never a simulated test result.

## 7. Agent PC

Pairing starts with a short-lived, single-use code owned by the signed-in user. The companion
receives one high-entropy device token and stores it in the OS credential store; Auto Web stores
its SHA-256 hash. Screen, input and file permissions start disabled and are granted locally.

Action creation checks device ownership, active session and permission. The companion action-start
endpoint and Rust execution path check them again. Read/write file paths must remain inside canonicalized,
user-selected folders. The local stop control clears the session immediately, including offline;
remote stop/revocation cancels pending work and is enforced at the next poll/action boundary.
No terminal, shell, elevation or hidden-control command is registered.

## 8. Deployment boundaries

Vercel can host the web application but is not assumed to host an indefinite worker. The worker
requires a persistent Node.js host; Docker tools require a separately reviewed Docker host. The
Windows companion is built and signed independently. Configuration, release gates and unverified
checks are documented in `docs/deployment.md` and `docs/testing.md`.
