import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import EmbeddedPostgres from "embedded-postgres";

const migrationDirectory = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No test port available"));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

const A = '10000000-0000-4000-8000-000000000001';
const B = '20000000-0000-4000-8000-000000000002';
const AGENT_A = '30000000-0000-4000-8000-000000000001';
const AGENT_B = '30000000-0000-4000-8000-000000000002';
const CONVERSATION = '40000000-0000-4000-8000-000000000001';
const CONNECTION = '50000000-0000-4000-8000-000000000001';
const TASK = '60000000-0000-4000-8000-000000000001';
let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions += 1; console.log(`✓ ${message}`); }
async function scalar(client, sql, params) { return (await client.query(sql, params)).rows[0]; }
async function denied(client, sql, params, message) {
  let error;
  try { await client.query(sql, params); } catch (caught) { error = caught; }
  check(error && error.code === '42501', message);
}
async function authenticate(client, userId) {
  await client.query(`set role authenticated`);
  await client.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
}

(async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-pg-"));
  const port = await availablePort();
  const pg = new EmbeddedPostgres({ databaseDir, user: "postgres", password: "postgres", port, persistent: false, onLog: () => {}, onError: () => {} });
  let client;
  try {
    await pg.initialise();
    await pg.start();
    client = pg.getPgClient();
    await client.connect();
    await client.query(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users (
        instance_id uuid, id uuid primary key default gen_random_uuid(), aud text, role text,
        email text unique, encrypted_password text, email_confirmed_at timestamptz,
        created_at timestamptz, updated_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
      $$;
      grant usage on schema auth to authenticated;
    `);
    for (const file of ['001_core.sql', '002_rls.sql', '003_worker.sql']) {
      await client.query(fs.readFileSync(path.join(migrationDirectory, file), "utf8"));
      console.log(`✓ Applied ${file}`);
    }
    await client.query(`grant all on all tables in schema public to service_role`);
    await client.query(`
      insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      values ('${A}', 'a@example.test', '{}', '{}'), ('${B}', 'b@example.test', '{}', '{}');
      insert into public.agents (id, user_id, name, role, instructions) values
        ('${AGENT_A}', '${A}', 'Agent A', 'Research', 'Research owned topics'),
        ('${AGENT_B}', '${B}', 'Agent B', 'Research', 'Research owned topics');
      insert into public.conversations (id, user_id, title) values ('${CONVERSATION}', '${A}', 'Private A');
      insert into public.messages (conversation_id, user_id, role, content) values ('${CONVERSATION}', '${A}', 'user', 'Private message');
      insert into public.provider_connections (id, user_id, provider, model) values ('${CONNECTION}', '${A}', 'gemini', 'test-model');
      insert into public.provider_connection_secrets (connection_id, user_id, encrypted_key) values ('${CONNECTION}', '${A}', 'encrypted-test-value');
      insert into public.tasks (id, user_id, agent_id, description) values ('${TASK}', '${A}', '${AGENT_A}', 'Private task');
    `);

    await authenticate(client, A);
    check((await scalar(client, 'select count(*)::int as n from public.agents')).n === 1, 'RLS: User A sees only their own agent');
    check((await scalar(client, 'select count(*)::int as n from public.conversations')).n === 1, 'RLS: User A sees their own conversation');
    check((await scalar(client, 'select count(*)::int as n from public.messages')).n === 1, 'RLS: User A sees their own message');
    check((await scalar(client, 'select count(*)::int as n from public.profiles where id = $1', [B])).n === 0, 'RLS: User A cannot read User B profile');
    await denied(client, 'select * from public.provider_connection_secrets', [], 'Grants: provider secrets are not browser-readable');
    await denied(client, 'select * from public.rate_limits', [], 'Grants: rate-limit internals are not browser-readable');
    await denied(client, `insert into public.tasks (user_id, agent_id, description) values ($1, $2, 'Direct write')`, [A, AGENT_A], 'RLS/grants: execution inserts are service-only');
    await denied(client, `insert into public.agents (user_id, name, role, instructions) values ($1, 'Invalid', 'Role', 'Invalid ownership')`, [B], 'RLS: agent ownership cannot be assigned to User B');
    await client.query(`update public.agents set description = 'Updated' where user_id = $1`, [A]);
    check(true, 'RLS: User A can update their own agent');
    await client.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: B, role: 'authenticated' })]);
    check((await scalar(client, 'select count(*)::int as n from public.agents')).n === 1, 'RLS: User B sees only their own agent');
    check((await scalar(client, 'select count(*)::int as n from public.conversations')).n === 0, 'RLS: User B cannot read User A conversation');
    check((await scalar(client, 'select count(*)::int as n from public.messages')).n === 0, 'RLS: User B cannot read User A messages');
    check((await scalar(client, 'select count(*)::int as n from public.tasks')).n === 0, 'RLS: User B cannot read User A task');
    await client.query('reset role');

    check((await scalar(client, `select public.check_rate_limit('test-key', 2, 60) as allowed`)).allowed === true, 'Rate limit: first request allowed');
    check((await scalar(client, `select public.check_rate_limit('test-key', 2, 60) as allowed`)).allowed === true, 'Rate limit: second request allowed');
    check((await scalar(client, `select public.check_rate_limit('test-key', 2, 60) as allowed`)).allowed === false, 'Rate limit: third request denied');

    let claim = await scalar(client, 'select * from public.claim_next_task()');
    check(claim.task_id === TASK && claim.run_id, 'Queue: atomic claim creates run attempt 1');
    check((await scalar(client, 'select status, lease_expires_at is not null as leased from public.tasks where id = $1', [TASK])).leased, 'Queue: claimed task has a lease');
    check((await scalar(client, 'select public.complete_task($1, $2, $3) as ok', [TASK, claim.run_id, 'Done'])).ok === true, 'Queue: active task completes atomically');
    check((await scalar(client, 'select public.complete_task($1, $2, $3) as ok', [TASK, claim.run_id, 'Late'])).ok === false, 'Queue: stale completion is rejected');
    check((await scalar(client, 'select status from public.tasks where id = $1', [TASK])).status === 'completed', 'Queue: completed status preserved');

    await client.query(`update public.tasks set status = 'queued', result = null where id = $1`, [TASK]);
    claim = await scalar(client, 'select * from public.claim_next_task()');
    await client.query(`update public.tasks set status = 'cancelled', lease_expires_at = null where id = $1`, [TASK]);
    check((await scalar(client, 'select public.complete_task($1, $2, $3) as ok', [TASK, claim.run_id, 'Late'])).ok === false, 'Queue: late completion cannot overwrite cancellation');
    check((await scalar(client, 'select status from public.tasks where id = $1', [TASK])).status === 'cancelled', 'Queue: cancellation preserved');

    await client.query(`update public.tasks set status = 'queued', result = null where id = $1`, [TASK]);
    claim = await scalar(client, 'select * from public.claim_next_task()');
    check((await scalar(client, `select public.request_tool_approval($1, $2, $3, 'web_search', '{"query":"Auto"}', now() + interval '30 minutes', 50) as ok`, [TASK, claim.run_id, A])).ok === true, 'Approvals: active task pauses atomically');
    const approval = await scalar(client, 'select id from public.tool_approvals where run_id = $1', [claim.run_id]);
    check((await scalar(client, 'select status from public.tasks where id = $1', [TASK])).status === 'waiting_approval', 'Approvals: task waits for a decision');
    check((await client.query('select * from public.decide_tool_approval($1, $2, $3)', [approval.id, B, 'approved'])).rowCount === 0, 'Approvals: wrong user cannot decide');
    let decision = await scalar(client, 'select * from public.decide_tool_approval($1, $2, $3)', [approval.id, A, 'approved']);
    check(decision.outcome === 'decided' && decision.task_status === 'queued', 'Approvals: owner approval queues a new attempt');
    decision = await scalar(client, 'select * from public.decide_tool_approval($1, $2, $3)', [approval.id, A, 'approved']);
    check(decision.outcome === 'closed', 'Approvals: duplicate decision is rejected');

    await client.query(`update public.tasks set status = 'running', lease_expires_at = now() - interval '1 second' where id = $1`, [TASK]);
    await client.query(`update public.agent_runs set status = 'running', finished_at = null where id = $1`, [claim.run_id]);
    await client.query('select public.expire_stale_work()');
    check((await scalar(client, 'select status from public.tasks where id = $1', [TASK])).status === 'failed', 'Recovery: work exceeding three attempts fails after lease expiry');

    const secondTask = '60000000-0000-4000-8000-000000000002';
    await client.query(`insert into public.tasks (id, user_id, agent_id, description) values ($1, $2, $3, 'Recover me')`, [secondTask, A, AGENT_A]);
    claim = await scalar(client, 'select * from public.claim_next_task()');
    check(claim.task_id === secondTask, 'Recovery: second task claimed');
    await client.query(`update public.tasks set lease_expires_at = now() - interval '1 second' where id = $1`, [secondTask]);
    await client.query('select public.expire_stale_work()');
    check((await scalar(client, 'select status from public.tasks where id = $1', [secondTask])).status === 'queued', 'Recovery: first expired lease is requeued');
    const reclaimed = await scalar(client, 'select * from public.claim_next_task()');
    check(reclaimed.run_id !== claim.run_id, 'Recovery: requeue creates a new run attempt');
    check((await scalar(client, 'select attempt from public.agent_runs where id = $1', [reclaimed.run_id])).attempt === 2, 'Recovery: attempt history is retained');

    const device = '70000000-0000-4000-8000-000000000001';
    const session = '70000000-0000-4000-8000-000000000002';
    const action = '70000000-0000-4000-8000-000000000003';
    await client.query(`insert into public.devices (id, user_id, name, app_version) values ($1, $2, 'Test PC', '0.1.0')`, [device, A]);
    await client.query(`insert into public.device_sessions (id, device_id, user_id) values ($1, $2, $3)`, [session, device, A]);
    await client.query(`insert into public.device_permissions (device_id, user_id, capability, enabled) values ($1, $2, 'input', true)`, [device, A]);
    await client.query(`insert into public.device_actions (id, session_id, device_id, user_id, type, payload)
      values ($1, $2, $3, $4, 'mouse_click', '{"button":"left"}')`, [action, session, device, A]);
    let claimedAction = (await scalar(client, 'select public.claim_device_action($1, $2, $3) as action', [action, device, A])).action;
    check(claimedAction?.status === 'running', 'Device: active session and permission allow one atomic claim');
    claimedAction = (await scalar(client, 'select public.claim_device_action($1, $2, $3) as action', [action, device, A])).action;
    check(claimedAction === null, 'Device: duplicate action claim is rejected');
    await client.query(`update public.device_actions set status = 'pending' where id = $1`, [action]);
    await client.query(`update public.device_sessions set status = 'stopped' where id = $1`, [session]);
    claimedAction = (await scalar(client, 'select public.claim_device_action($1, $2, $3) as action', [action, device, A])).action;
    check(claimedAction === null, 'Device: stopped session blocks execution');
    await client.query(`update public.device_sessions set status = 'active', ended_at = null where id = $1`, [session]);
    await client.query(`update public.device_permissions set enabled = false where device_id = $1 and capability = 'input'`, [device]);
    claimedAction = (await scalar(client, 'select public.claim_device_action($1, $2, $3) as action', [action, device, A])).action;
    check(claimedAction === null, 'Device: revoked permission blocks execution');
    await client.query(`update public.device_permissions set enabled = true where device_id = $1 and capability = 'input'`, [device]);
    await client.query(`update public.device_actions set expires_at = now() - interval '1 second' where id = $1`, [action]);
    claimedAction = (await scalar(client, 'select public.claim_device_action($1, $2, $3) as action', [action, device, A])).action;
    check(claimedAction === null, 'Device: expired action cannot execute');

    console.log(`\n${assertions} PostgreSQL integration assertions passed.`);
  } finally {
    if (client) await client.end();
    await pg.stop();
  }
})().catch((error) => { console.error(error); process.exit(1); });
