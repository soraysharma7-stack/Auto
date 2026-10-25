import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { queueDeviceAction } from "@/lib/devices/actions";
import { decryptSecret } from "@/lib/security/secrets";
import { CodingSandbox, runDockerTests } from "@/lib/tools/sandbox";
import { searchWeb } from "@/lib/tools/web-search";
import type { ToolName } from "@/lib/types";

export type ToolContext = {
  supabase: SupabaseClient;
  userId: string;
  taskId: string;
  runId: string;
  sandbox: CodingSandbox;
  signal?: AbortSignal;
};

export type ToolDefinition = {
  name: ToolName;
  description: string;
  requiresApproval: boolean;
  inputSchema: z.ZodType<Record<string, unknown>>;
  execute(context: ToolContext, input: Record<string, unknown>): Promise<unknown>;
};

const webSearchInput = z.object({ query: z.string().trim().min(2).max(500), maxResults: z.number().int().min(1).max(8).default(5) });
const readFileInput = z.object({ path: z.string().min(1).max(300) });
const writeFileInput = z.object({ path: z.string().min(1).max(300), content: z.string().max(500_000) });
const testInput = z.object({ command: z.string().min(1).max(100) });
const deviceInput = z.object({
  sessionId: z.uuid(),
  type: z.enum(["screen_snapshot", "mouse_move", "mouse_click", "type_text", "read_file", "write_file"]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const toolRegistry: Record<ToolName, ToolDefinition> = {
  web_search: {
    name: "web_search",
    description: "Search through the user's verified Tavily connection.",
    requiresApproval: false,
    inputSchema: webSearchInput,
    async execute(context, raw) {
      const input = webSearchInput.parse(raw);
      const { data: connection } = await context.supabase.from("provider_connections").select("id").eq("user_id", context.userId).eq("provider", "tavily").eq("status", "verified").order("priority").limit(1).maybeSingle();
      if (!connection) throw new AppError("A verified Tavily connection is required", 409, "SEARCH_UNAVAILABLE");
      const { data: secret } = await context.supabase.from("provider_connection_secrets").select("encrypted_key").eq("connection_id", connection.id).eq("user_id", context.userId).single();
      if (!secret) throw new AppError("Search credentials are unavailable", 409, "SEARCH_UNAVAILABLE");
      const results = await searchWeb(decryptSecret(secret.encrypted_key), input.query, input.maxResults, context.signal);
      await context.supabase.from("usage_events").insert({ user_id: context.userId, connection_id: connection.id, provider: "tavily", kind: "search", status: "completed" });
      return { results };
    },
  },
  read_file: {
    name: "read_file",
    description: "Read a UTF-8 file inside the run's isolated workspace.",
    requiresApproval: false,
    inputSchema: readFileInput,
    async execute(context, raw) {
      const input = readFileInput.parse(raw);
      return { path: input.path, content: await context.sandbox.read(input.path) };
    },
  },
  write_file: {
    name: "write_file",
    description: "Write a UTF-8 file inside the run's isolated workspace.",
    requiresApproval: true,
    inputSchema: writeFileInput,
    async execute(context, raw) {
      const input = writeFileInput.parse(raw);
      await context.sandbox.write(input.path, input.content);
      return { path: input.path, bytes: Buffer.byteLength(input.content), written: true };
    },
  },
  run_tests: {
    name: "run_tests",
    description: "Run an allowlisted test command in Docker without network access.",
    requiresApproval: true,
    inputSchema: testInput,
    async execute(context, raw) {
      const input = testInput.parse(raw);
      return runDockerTests(context.sandbox.root, input.command, context.signal);
    },
  },
  device_action: {
    name: "device_action",
    description: "Queue a permission-checked action for a paired, active PC session.",
    requiresApproval: true,
    inputSchema: deviceInput,
    async execute(context, raw) {
      const input = deviceInput.parse(raw);
      const action = await queueDeviceAction(context.supabase, context.userId, input);
      return {
        action: { id: action.id, status: action.status, expires_at: action.expires_at },
        message: "Action queued. It has not completed until the companion reports a result.",
      };
    },
  },
};

export function validateToolInput(tool: ToolName, input: Record<string, unknown>): Record<string, unknown> {
  const result = toolRegistry[tool].inputSchema.safeParse(input);
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? "Invalid tool input", 422, "INVALID_TOOL_INPUT");
  return result.data;
}
