# Security model and review

## Trust boundaries

- The browser is untrusted. Supabase Auth establishes identity; every API revalidates ownership.
- PostgreSQL RLS and explicit grants are a second boundary. Execution/audit tables reject direct
  authenticated writes. Provider secrets have no browser-readable policy or grant.
- The Next.js server decrypts provider keys only in memory for an official API request.
- The worker is a separate privileged process with narrow task-claim and tool execution behavior.
- Auto Agent PC holds its device token locally. A visible native process, active session and local
  permission are all required before an OS action.

## Secret handling

Provider keys are encrypted with AES-256-GCM using a fresh 96-bit nonce and authentication tag.
Device tokens are high-entropy random values; only SHA-256 hashes are stored server-side. Pairing
codes expire after ten minutes, are single-use, and are hashed at rest. Rate-limit keys are hashed
so raw IPs/user identifiers are not stored in that table. Export responses explicitly omit
`encrypted_key`, token hashes and rate-limit internals.

Client components import provider metadata from a client-safe catalog, not server adapters or
secret helpers. Server-only modules mark encryption, routing, device auth and Supabase admin code.
No API returns a provider credential or device token after its initial pairing response.

## Execution policy

- Request schemas enforce lengths, enums and numeric limits with Zod.
- Agent allowlists are checked before tool dispatch; tool inputs are checked again by each tool.
- Research uses official Tavily HTTPS APIs and validated URLs/result schemas.
- Workspace paths reject absolute paths, traversal and null bytes. Device paths are canonicalized
  and must remain inside user-selected folders at execution time.
- Build/test execution uses a fixed command allowlist, never model-supplied shell text. Docker is
  opt-in and unavailable tools fail rather than claiming a test ran.
- MAX mode increases model limits; it does not grant administrator rights or bypass approvals.
- Tasks default to 12 total model attempts (20 in MAX), including provider fallback. Chat, task,
  connection and pairing endpoints have persistent database-backed request limits.

## Device safety

All companion permissions begin disabled. Pairing alone grants no screen, input or file access.
The user starts a visible session locally. Server action creation checks device ownership,
session and permission; action start and Rust execution check them again. Revocation and stop
cancel pending actions. Polling runs every three seconds, so remote revocation is enforced on the
next poll/action boundary; the local **Stop Agent now** control clears the session immediately,
including offline. No terminal, shell, elevation or hidden-window command is registered.

Screen snapshots are sensitive and capped at 5 MB before upload. File reads/writes are capped and
bounded to approved folders. Auto never asks for a Windows password, browser cookie or website password.

## Audit and privacy

Security-relevant server transitions create audit events without provider secrets or full message
bodies. Usage events store provider/model, token counts when supplied and status—not invented
costs. Account export gathers owned records through an explicit non-secret connection query.
Account deletion removes the auth identity and relies on owned-row cascades.

Conversation context includes recent non-failed messages only and is reduced to whole messages
within the selected connection's declared context limit. Auto does not create vector embeddings or
a hidden long-term memory store.

## Remaining release work

This source review is not a penetration test. Before production, run the pgTAP suite, test real
provider failures and worker recovery, compile and exercise the companion on Windows, inspect the
Docker boundary on its intended host, configure proxy/IP trust correctly, add dependency update
and signing processes, and perform an independent security review. Rate limits and model-call
budgets are abuse/cost controls, not guarantees against provider charges.
