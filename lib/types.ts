export type AIMode = "auto" | "deep" | "coding" | "max" | "student";
export type ProviderId = "gemini" | "openai" | "anthropic" | "tavily";
export type AIProviderId = Exclude<ProviderId, "tavily">;
export type ToolName = "web_search" | "read_file" | "write_file" | "run_tests" | "device_action";

export type Agent = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  role: string;
  instructions: string;
  preferred_provider: AIProviderId | null;
  preferred_model: string | null;
  allowed_tools: ToolName[];
  requires_approval: boolean;
  max_output_tokens: number;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type Task = {
  id: string;
  user_id: string;
  agent_id: string;
  description: string;
  mode: AIMode;
  status: TaskStatus;
  max_model_calls: number;
  lease_expires_at: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  agents?: Pick<Agent, "name"> | null;
};

export type ProviderConnection = {
  id: string;
  user_id: string;
  provider: ProviderId;
  model: string;
  priority: number;
  supported_modes: AIMode[];
  context_limit_tokens: number;
  latency_ms: number | null;
  status: "not_checked" | "verified" | "unavailable" | "rate_limited";
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  mode: AIMode;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider: string | null;
  model: string | null;
  status: "completed" | "failed";
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

export type Device = {
  id: string;
  user_id: string;
  name: string;
  app_version: string;
  status: "active" | "revoked";
  paired_at: string;
  last_seen_at: string | null;
  created_at: string;
};
