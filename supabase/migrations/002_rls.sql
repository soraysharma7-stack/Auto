-- Enable RLS on every exposed table. Secret and credential tables intentionally have
-- no authenticated policies: only the server-side service role may access them.
alter table public.profiles enable row level security;
alter table public.provider_connections enable row level security;
alter table public.provider_connection_secrets enable row level security;
alter table public.agents enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.run_steps enable row level security;
alter table public.tool_approvals enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.devices enable row level security;
alter table public.device_credentials enable row level security;
alter table public.device_pairing_codes enable row level security;
alter table public.device_permissions enable row level security;
alter table public.device_sessions enable row level security;
alter table public.device_actions enable row level security;

-- Profile owners can read and update their non-identity preferences.
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Execution and integration mutations go through authorized server APIs. Authenticated
-- roles receive read policies only, preserving state-machine and approval invariants.
create policy connections_select_own on public.provider_connections for select to authenticated using (user_id = (select auth.uid()));
create policy agents_all_own on public.agents for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy conversations_select_own on public.conversations for select to authenticated using (user_id = (select auth.uid()));
create policy messages_select_own on public.messages for select to authenticated using (user_id = (select auth.uid()));
create policy tasks_select_own on public.tasks for select to authenticated using (user_id = (select auth.uid()));
create policy runs_select_own on public.agent_runs for select to authenticated using (user_id = (select auth.uid()));
create policy steps_select_own on public.run_steps for select to authenticated using (user_id = (select auth.uid()));
create policy approvals_select_own on public.tool_approvals for select to authenticated using (user_id = (select auth.uid()));
create policy usage_select_own on public.usage_events for select to authenticated using (user_id = (select auth.uid()));
create policy audit_select_own on public.audit_logs for select to authenticated using (user_id = (select auth.uid()));
create policy devices_select_own on public.devices for select to authenticated using (user_id = (select auth.uid()));
create policy permissions_select_own on public.device_permissions for select to authenticated using (user_id = (select auth.uid()));
create policy sessions_select_own on public.device_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy actions_select_own on public.device_actions for select to authenticated using (user_id = (select auth.uid()));

-- Defensive message ownership includes both the message owner and conversation owner.
drop policy messages_select_own on public.messages;
create policy messages_select_own on public.messages for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  )
);

-- Explicit grants; no anonymous access to application records.
revoke all on all tables in schema public from anon;
grant select on public.provider_connections, public.conversations, public.messages,
  public.tasks, public.agent_runs, public.run_steps, public.tool_approvals,
  public.usage_events, public.audit_logs, public.devices, public.device_permissions,
  public.device_sessions, public.device_actions to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
revoke all on public.provider_connection_secrets, public.device_credentials,
  public.device_pairing_codes from authenticated, anon;
