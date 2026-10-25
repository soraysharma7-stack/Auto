create extension if not exists pgtap with schema extensions;

begin;
select plan(16);

-- Two independent auth identities and owned records.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'auto-a@example.test', crypt('password', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'auto-b@example.test', crypt('password', gen_salt('bf')), now(), now(), now(), '{}', '{}');

insert into public.agents (id, user_id, name, role, instructions) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Agent A', 'Research', 'Research owned topics'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Agent B', 'Research', 'Research owned topics');
insert into public.conversations (id, user_id, title) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Private A');
insert into public.messages (conversation_id, user_id, role, content) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'user', 'Private message');
insert into public.provider_connections (id, user_id, provider, model) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'gemini', 'test-model');
insert into public.provider_connection_secrets (connection_id, user_id, encrypted_key) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'encrypted-test-value');
insert into public.tasks (id, user_id, agent_id, description) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Private task');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::integer from public.agents), 1, 'User A sees only their own agents');
select is((select count(*)::integer from public.agents where user_id = '20000000-0000-0000-0000-000000000002'), 0, 'User A cannot see User B agents');
select is((select count(*)::integer from public.conversations), 1, 'User A sees their own conversation');
select is((select count(*)::integer from public.messages), 1, 'User A sees their own messages');
select throws_ok('select * from public.provider_connection_secrets', '42501', null, 'Provider secrets have no authenticated read grant');
select throws_ok('select * from public.rate_limits', '42501', null, 'Rate-limit internals have no authenticated read grant');
select is((select count(*)::integer from public.tasks), 1, 'User A can read their task');
select throws_ok(
  'insert into public.tasks (user_id, agent_id, description) values (''10000000-0000-0000-0000-000000000001'', ''30000000-0000-0000-0000-000000000001'', ''Direct write'')',
  '42501',
  null,
  'Execution tables reject direct authenticated inserts'
);
select throws_ok(
  'insert into public.agents (user_id, name, role, instructions) values (''20000000-0000-0000-0000-000000000002'', ''Escalated'', ''Role'', ''Invalid ownership'')',
  '42501',
  null,
  'Agent insert cannot assign ownership to another user'
);
select lives_ok(
  'update public.agents set description = ''Updated'' where user_id = ''10000000-0000-0000-0000-000000000001''',
  'User A can update their own agent'
);
select is((select count(*)::integer from public.profiles where id = '20000000-0000-0000-0000-000000000002'), 0, 'User A cannot read User B profile');

set local request.jwt.claims = '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.agents), 1, 'User B sees only their own agents');
select is((select count(*)::integer from public.conversations), 0, 'User B cannot read User A conversation');
select is((select count(*)::integer from public.messages), 0, 'User B cannot read User A messages');
select is((select count(*)::integer from public.tasks), 0, 'User B cannot read User A task');
select throws_ok('select * from public.provider_connection_secrets', '42501', null, 'User B cannot read provider secrets either');

select * from finish();
rollback;
