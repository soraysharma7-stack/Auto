# Supabase

This directory contains the actual PostgreSQL schema and security boundaries used by Auto Web:

- `migrations/001_core.sql`: owned records, enums, indexes and profile provisioning.
- `migrations/002_rls.sql`: Row Level Security, ownership policies and explicit grants.
- `migrations/003_worker.sql`: persistent rate limits, atomic task/approval transitions, leases,
  recovery and maintenance functions.
- `tests/001_rls.sql`: pgTAP cross-user isolation and secret/grant tests for a full Supabase stack.
- `config.toml`: local Supabase CLI configuration.

Provider credentials and device token hashes are isolated from browser-readable tables. Execution,
usage, audit and rate-limit mutations are service-only. Server APIs still scope every operation to
the authenticated owner because the service-role key bypasses RLS.

## Verification

```bash
npm run test:database  # Real temporary PostgreSQL 18 migrations + 33 security/queue assertions
npm run db:start       # Full local Supabase stack; requires Docker
npm run db:reset
npm run db:test        # pgTAP suite; requires the full local stack
```

The portable harness supplies the minimal `auth.users`, roles and `auth.uid()` compatibility needed
to exercise the migrations. It does not replace managed Supabase Auth, PostgREST or pgTAP smoke
tests. Apply reviewed migrations to a remote project; never reset a production database.

See [`docs/architecture.md`](../docs/architecture.md) and
[`docs/deployment.md`](../docs/deployment.md) for ownership and deployment boundaries.
