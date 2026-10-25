create table public.rate_limits (
  rate_key text primary key,
  request_count integer not null,
  window_started_at timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

create or replace function public.check_rate_limit(
  p_rate_key text,
  p_rate_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if p_rate_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  insert into public.rate_limits (rate_key, request_count, window_started_at)
  values (p_rate_key, 1, now())
  on conflict (rate_key) do update
  set request_count = case
    when public.rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then 1
    else public.rate_limits.request_count + 1
  end,
  window_started_at = case
    when public.rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then now()
    else public.rate_limits.window_started_at
  end
  returning request_count into v_count;

  return v_count <= p_rate_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

create or replace function public.claim_next_task()
returns table(task_id uuid, run_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_task_id uuid;
  v_run_id uuid;
  v_attempt integer;
begin
  select t.id into v_task_id from public.tasks t
  where t.status = 'queued'
  order by t.created_at
  for update skip locked
  limit 1;

  if v_task_id is null then return; end if;

  select coalesce(max(r.attempt), 0) + 1 into v_attempt
  from public.agent_runs r where r.task_id = v_task_id;

  insert into public.agent_runs (task_id, user_id, attempt)
  select v_task_id, t.user_id, v_attempt from public.tasks t where t.id = v_task_id
  returning id into v_run_id;

  update public.tasks
  set status = 'running', error = null, lease_expires_at = now() + interval '5 minutes'
  where id = v_task_id;
  return query select v_task_id, v_run_id;
end;
$$;

revoke all on function public.claim_next_task() from public, anon, authenticated;
grant execute on function public.claim_next_task() to service_role;

create or replace function public.complete_task(p_task_id uuid, p_run_id uuid, p_result text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_task_status public.task_status;
  v_run_status public.run_status;
begin
  select t.status, r.status into v_task_status, v_run_status
  from public.tasks t join public.agent_runs r on r.task_id = t.id
  where t.id = p_task_id and r.id = p_run_id
  for update of t, r;
  if v_task_status is null or v_run_status is null
    or v_task_status <> 'running' or v_run_status <> 'running' then
    return false;
  end if;

  update public.agent_runs
  set status = 'completed', progress = 100, result = p_result, error = null, finished_at = now()
  where id = p_run_id;
  update public.tasks
  set status = 'completed', result = p_result, error = null, lease_expires_at = null
  where id = p_task_id;
  return true;
end;
$$;

create or replace function public.fail_task(p_task_id uuid, p_run_id uuid, p_error text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_task_status public.task_status;
  v_run_status public.run_status;
begin
  select t.status, r.status into v_task_status, v_run_status
  from public.tasks t join public.agent_runs r on r.task_id = t.id
  where t.id = p_task_id and r.id = p_run_id
  for update of t, r;
  if v_task_status is null or v_run_status is null
    or v_task_status not in ('running', 'waiting_approval')
    or v_run_status not in ('running', 'waiting_approval') then
    return false;
  end if;

  update public.agent_runs
  set status = 'failed', error = left(p_error, 1000), finished_at = now()
  where id = p_run_id;
  update public.tasks
  set status = 'failed', error = left(p_error, 1000), lease_expires_at = null
  where id = p_task_id;
  return true;
end;
$$;

create or replace function public.request_tool_approval(
  p_task_id uuid,
  p_run_id uuid,
  p_user_id uuid,
  p_tool_name text,
  p_tool_input jsonb,
  p_expires_at timestamptz,
  p_progress integer
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_task_status public.task_status;
  v_run_status public.run_status;
begin
  select t.status, r.status into v_task_status, v_run_status
  from public.tasks t join public.agent_runs r on r.task_id = t.id
  where t.id = p_task_id and r.id = p_run_id and t.user_id = p_user_id
  for update of t, r;
  if v_task_status is null or v_task_status <> 'running'
    or v_run_status is null or v_run_status <> 'running' then
    return false;
  end if;

  insert into public.tool_approvals (user_id, task_id, run_id, tool_name, tool_input, expires_at)
  values (p_user_id, p_task_id, p_run_id, p_tool_name, p_tool_input, p_expires_at);
  update public.agent_runs set status = 'waiting_approval', progress = p_progress where id = p_run_id;
  update public.tasks set status = 'waiting_approval', lease_expires_at = null where id = p_task_id;
  return true;
end;
$$;

create or replace function public.decide_tool_approval(
  p_approval_id uuid,
  p_user_id uuid,
  p_decision text
)
returns table(outcome text, task_id uuid, task_status public.task_status)
language plpgsql security definer set search_path = public as $$
declare
  v_approval_id uuid;
  v_task_id uuid;
  v_run_id uuid;
  v_approval_status public.approval_status;
  v_task_status public.task_status;
  v_expires_at timestamptz;
  v_next_status public.task_status;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid approval decision';
  end if;

  select a.id, a.task_id, a.run_id, a.status, t.status, a.expires_at
  into v_approval_id, v_task_id, v_run_id, v_approval_status, v_task_status, v_expires_at
  from public.tool_approvals a
  join public.tasks t on t.id = a.task_id
  where a.id = p_approval_id and a.user_id = p_user_id and t.user_id = p_user_id
  for update of a, t;
  if v_approval_id is null then return; end if;
  if v_approval_status <> 'pending' then
    return query select 'closed'::text, v_task_id, v_task_status;
    return;
  end if;
  if v_task_status <> 'waiting_approval' then
    return query select 'closed'::text, v_task_id, v_task_status;
    return;
  end if;

  if v_expires_at <= now() then
    update public.tool_approvals set status = 'expired', decided_at = now() where id = v_approval_id;
    update public.agent_runs set status = 'failed', error = 'Approval expired', finished_at = now() where id = v_run_id;
    update public.tasks set status = 'failed', error = 'Approval expired', lease_expires_at = null where id = v_task_id;
    return query select 'expired'::text, v_task_id, 'failed'::public.task_status;
    return;
  end if;

  v_next_status := case when p_decision = 'approved' then 'queued'::public.task_status else 'failed'::public.task_status end;
  update public.tool_approvals
  set status = p_decision::public.approval_status, decided_at = now()
  where id = v_approval_id;
  update public.agent_runs
  set status = case when p_decision = 'approved' then 'completed'::public.run_status else 'failed'::public.run_status end,
    result = case when p_decision = 'approved' then 'Approval recorded; resume in a new attempt' else null end,
    error = case when p_decision = 'rejected' then 'Tool approval rejected' else null end,
    finished_at = now()
  where id = v_run_id;
  update public.tasks
  set status = v_next_status,
    error = case when p_decision = 'rejected' then 'Tool approval rejected' else null end,
    lease_expires_at = null
  where id = v_task_id;
  return query select 'decided'::text, v_task_id, v_next_status;
end;
$$;

revoke all on function public.request_tool_approval(uuid, uuid, uuid, text, jsonb, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.request_tool_approval(uuid, uuid, uuid, text, jsonb, timestamptz, integer) to service_role;
revoke all on function public.complete_task(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_task(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.decide_tool_approval(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.complete_task(uuid, uuid, text) to service_role;
grant execute on function public.fail_task(uuid, uuid, text) to service_role;
grant execute on function public.decide_tool_approval(uuid, uuid, text) to service_role;

create or replace function public.claim_device_action(
  p_action_id uuid,
  p_device_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_action public.device_actions%rowtype;
  v_capability text;
  v_permission_enabled boolean;
begin
  select a.* into v_action
  from public.device_actions a
  join public.device_sessions s on s.id = a.session_id and s.status = 'active'
  join public.devices d on d.id = a.device_id and d.status = 'active'
  where a.id = p_action_id and a.device_id = p_device_id and a.user_id = p_user_id
    and a.status = 'pending' and a.expires_at > now()
  for update of a, s, d;
  if v_action.id is null then return null; end if;

  v_capability := case
    when v_action.type = 'screen_snapshot' then 'screen'
    when v_action.type in ('read_file', 'write_file') then 'files'
    else 'input'
  end;
  select p.enabled into v_permission_enabled
  from public.device_permissions p
  where p.device_id = p_device_id and p.user_id = p_user_id and p.capability = v_capability
  for update;
  if v_permission_enabled is not true then return null; end if;

  update public.device_actions set status = 'running', updated_at = now() where id = v_action.id;
  return jsonb_build_object(
    'id', v_action.id,
    'session_id', v_action.session_id,
    'type', v_action.type,
    'payload', v_action.payload,
    'status', 'running',
    'expires_at', v_action.expires_at
  );
end;
$$;

revoke all on function public.claim_device_action(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_device_action(uuid, uuid, uuid) to service_role;

create or replace function public.expire_stale_work()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_stale_task_id uuid;
begin
  update public.tool_approvals
  set status = 'expired', decided_at = now()
  where status = 'pending' and expires_at < now();
  get diagnostics v_count = row_count;

  update public.agent_runs r
  set status = 'failed', error = 'Approval expired', finished_at = now()
  from public.tool_approvals a
  where a.run_id = r.id and a.status = 'expired' and r.status = 'waiting_approval';

  update public.tasks t
  set status = 'failed', error = 'Approval expired'
  from public.tool_approvals a
  where a.task_id = t.id and a.status = 'expired' and t.status = 'waiting_approval';

  for v_stale_task_id in
    select id from public.tasks
    where status = 'running' and lease_expires_at < now()
    for update skip locked
  loop
    update public.agent_runs
    set status = 'failed', error = 'Worker lease expired', finished_at = now()
    where task_id = v_stale_task_id and status = 'running';
    update public.tasks t
    set status = case
        when (select count(*) from public.agent_runs r where r.task_id = t.id) < 3 then 'queued'::public.task_status
        else 'failed'::public.task_status
      end,
      error = 'Worker lease expired',
      lease_expires_at = null
    where id = v_stale_task_id;
  end loop;

  update public.device_actions
  set status = 'cancelled', error = 'Action expired before execution'
  where status in ('pending', 'running') and expires_at < now();

  update public.device_sessions
  set status = 'expired', ended_at = now()
  where status = 'active' and last_seen_at < now() - interval '90 seconds';

  update public.device_actions a
  set status = 'cancelled', error = 'Device session expired'
  from public.device_sessions s
  where s.id = a.session_id and s.status = 'expired' and a.status in ('pending', 'running');

  return v_count;
end;
$$;

revoke all on function public.expire_stale_work() from public, anon, authenticated;
grant execute on function public.expire_stale_work() to service_role;
