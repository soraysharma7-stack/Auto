create extension if not exists pgcrypto;

create type public.ai_mode as enum ('auto', 'deep', 'coding', 'max', 'student');
create type public.task_status as enum ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled');
create type public.run_status as enum ('running', 'waiting_approval', 'completed', 'failed', 'cancelled');
create type public.connection_status as enum ('not_checked', 'verified', 'unavailable', 'rate_limited');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'expired');
create type public.device_status as enum ('active', 'revoked');
create type public.session_status as enum ('active', 'stopped', 'revoked', 'expired');
create type public.device_action_status as enum ('pending', 'running', 'completed', 'failed', 'cancelled');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai', 'anthropic', 'tavily')),
  model text not null default '',
  priority integer not null default 50 check (priority between 1 and 100),
  supported_modes text[] not null default array['auto', 'deep', 'coding', 'max', 'student'],
  context_limit_tokens integer not null default 128000 check (context_limit_tokens between 4096 and 2000000),
  latency_ms integer,
  status public.connection_status not null default 'not_checked',
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_connection_secrets (
  connection_id uuid primary key references public.provider_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_key text not null,
  created_at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  role text not null,
  instructions text not null,
  preferred_provider text check (preferred_provider in ('gemini', 'openai', 'anthropic')),
  preferred_model text,
  allowed_tools text[] not null default '{}',
  requires_approval boolean not null default true,
  max_output_tokens integer not null default 2048 check (max_output_tokens between 128 and 16384),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  mode public.ai_mode not null default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  provider text,
  model text,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  description text not null,
  mode public.ai_mode not null default 'auto',
  status public.task_status not null default 'queued',
  max_model_calls integer not null default 12 check (max_model_calls between 1 and 20),
  lease_expires_at timestamptz,
  result text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt integer not null check (attempt > 0),
  status public.run_status not null default 'running',
  progress integer not null default 0 check (progress between 0 and 100),
  result text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique(task_id, attempt)
);

create table public.run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_number integer not null,
  kind text not null check (kind in ('model', 'tool', 'approval', 'error')),
  content text not null default '',
  tool_name text,
  tool_input jsonb,
  tool_output jsonb,
  created_at timestamptz not null default now()
);

create table public.tool_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  tool_name text not null,
  tool_input jsonb not null,
  status public.approval_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  decided_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.provider_connections(id) on delete set null,
  task_id uuid references public.tasks(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete cascade,
  provider text not null,
  model text not null default '',
  kind text not null check (kind in ('chat', 'task', 'search', 'verification')),
  input_tokens integer,
  output_tokens integer,
  status text not null check (status in ('completed', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  app_version text not null,
  status public.device_status not null default 'active',
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device_credentials (
  device_id uuid primary key references public.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table public.device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device_permissions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability in ('screen', 'input', 'files')),
  enabled boolean not null default false,
  paths text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique(device_id, capability)
);

create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.session_status not null default 'active',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.device_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.device_sessions(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('screen_snapshot', 'mouse_move', 'mouse_click', 'type_text', 'read_file', 'write_file')),
  payload jsonb not null default '{}'::jsonb,
  status public.device_action_status not null default 'pending',
  result jsonb,
  error text,
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_user_idx on public.agents(user_id, updated_at desc);
create index conversations_user_idx on public.conversations(user_id, updated_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index tasks_user_idx on public.tasks(user_id, created_at desc);
create index tasks_claim_idx on public.tasks(status, created_at) where status = 'queued';
create index runs_task_idx on public.agent_runs(task_id, attempt desc);
create index approvals_user_idx on public.tool_approvals(user_id, status, created_at desc);
create index usage_user_idx on public.usage_events(user_id, created_at desc);
create index audit_user_idx on public.audit_logs(user_id, created_at desc);
create index devices_user_idx on public.devices(user_id, last_seen_at desc);
create index actions_device_idx on public.device_actions(device_id, status, created_at);
create unique index one_active_session_per_device on public.device_sessions(device_id) where status = 'active';

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger connections_updated_at before update on public.provider_connections for each row execute function public.set_updated_at();
create trigger agents_updated_at before update on public.agents for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger permissions_updated_at before update on public.device_permissions for each row execute function public.set_updated_at();
create trigger actions_updated_at before update on public.device_actions for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();
