import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { providerAdapters } from "@/lib/ai/providers";
import { ProviderError, type AIMessage, type AIResponse } from "@/lib/ai/types";
import { AppError } from "@/lib/errors";
import { decryptSecret } from "@/lib/security/secrets";
import type { AIMode, AIProviderId, ProviderConnection } from "@/lib/types";

export function rankConnections<T extends ProviderConnection>(
  connections: T[],
  preferredProvider?: AIProviderId | null,
  preferredModel?: string | null,
): T[] {
  return [...connections].sort((a, b) => {
    const aPreferred = Number(a.provider === preferredProvider) + Number(Boolean(preferredModel && a.model === preferredModel));
    const bPreferred = Number(b.provider === preferredProvider) + Number(Boolean(preferredModel && b.model === preferredModel));
    return bPreferred - aPreferred
      || a.priority - b.priority
      || (a.latency_ms ?? Number.MAX_SAFE_INTEGER) - (b.latency_ms ?? Number.MAX_SAFE_INTEGER)
      || a.created_at.localeCompare(b.created_at);
  });
}

export function shouldAttemptFallback(error: ProviderError, signal?: AbortSignal): boolean {
  return error.retryable && !signal?.aborted;
}

/** Keeps the system prompt and newest whole messages within a connection's declared budget. */
export function fitMessagesToContext(
  messages: AIMessage[],
  contextLimitTokens: number,
  maxOutputTokens: number,
): AIMessage[] | null {
  const budgetCharacters = (contextLimitTokens - maxOutputTokens) * 4;
  if (budgetCharacters <= 0) return null;
  const system = messages.filter((message) => message.role === "system");
  const conversation = messages.filter((message) => message.role !== "system");
  const systemLength = system.reduce((sum, message) => sum + message.content.length, 0);
  if (systemLength > budgetCharacters || !conversation.length) return null;

  let remaining = budgetCharacters - systemLength;
  const newestFirst: AIMessage[] = [];
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const message = conversation[index];
    if (message.content.length > remaining) {
      // Never truncate the latest user request. Older context is dropped as a unit.
      if (index === conversation.length - 1) return null;
      break;
    }
    newestFirst.push(message);
    remaining -= message.content.length;
  }
  return [...system, ...newestFirst.reverse()];
}

export async function generateWithRouter(input: {
  supabase: SupabaseClient;
  userId: string;
  messages: AIMessage[];
  mode: AIMode;
  kind: "chat" | "task";
  taskId?: string;
  runId?: string;
  maxOutputTokens?: number;
  preferredProvider?: AIProviderId | null;
  preferredModel?: string | null;
  signal?: AbortSignal;
}): Promise<AIResponse & { connectionId: string }> {
  const { data, error } = await input.supabase
    .from("provider_connections")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "verified")
    .neq("provider", "tavily");
  if (error) throw new AppError("Provider connections could not be loaded", 500, "DATABASE_ERROR");

  const connections = rankConnections(
    ((data ?? []) as ProviderConnection[]).filter((connection) => connection.supported_modes.includes(input.mode)),
    input.preferredProvider,
    input.preferredModel,
  );
  if (!connections.length) {
    throw new AppError("Connect and verify an AI provider before sending messages", 409, "NO_PROVIDER");
  }

  const { data: secrets, error: secretError } = await input.supabase
    .from("provider_connection_secrets")
    .select("connection_id, encrypted_key")
    .eq("user_id", input.userId)
    .in("connection_id", connections.map((connection) => connection.id));
  if (secretError) throw new AppError("Provider credentials could not be loaded", 500, "DATABASE_ERROR");
  const secretMap = new Map((secrets ?? []).map((secret) => [secret.connection_id, secret.encrypted_key]));

  let lastError: ProviderError | null = null;
  let attemptedProvider = false;
  for (const connection of connections) {
    const encryptedKey = secretMap.get(connection.id);
    if (!encryptedKey || connection.provider === "tavily") continue;
    const maxOutputTokens = input.maxOutputTokens ?? 2048;
    const messages = fitMessagesToContext(input.messages, connection.context_limit_tokens, maxOutputTokens);
    if (!messages) {
      lastError = new ProviderError("The request exceeds every eligible model context", "invalid_response", false);
      continue;
    }
    attemptedProvider = true;
    const provider = connection.provider;
    const startedAt = Date.now();
    try {
      const response = await providerAdapters[provider].generate(decryptSecret(encryptedKey), {
        messages,
        model: connection.model,
        mode: input.mode,
        maxOutputTokens,
        signal: input.signal,
      });
      const latency = Date.now() - startedAt;
      await input.supabase.from("usage_events").insert({
        user_id: input.userId,
        connection_id: connection.id,
        task_id: input.taskId ?? null,
        run_id: input.runId ?? null,
        provider,
        model: response.model,
        kind: input.kind,
        input_tokens: response.inputTokens ?? null,
        output_tokens: response.outputTokens ?? null,
        status: "completed",
      });
      await input.supabase.from("provider_connections").update({
        status: "verified",
        last_checked_at: new Date().toISOString(),
        last_error: null,
        latency_ms: connection.latency_ms === null ? latency : Math.round(connection.latency_ms * 0.7 + latency * 0.3),
      }).eq("id", connection.id).eq("user_id", input.userId);
      return { ...response, connectionId: connection.id };
    } catch (caught) {
      const providerError = caught instanceof ProviderError
        ? caught
        : new ProviderError("The provider request failed", "provider_error", false);
      lastError = providerError;
      await input.supabase.from("usage_events").insert({
        user_id: input.userId,
        connection_id: connection.id,
        task_id: input.taskId ?? null,
        run_id: input.runId ?? null,
        provider,
        model: connection.model,
        kind: input.kind,
        status: "failed",
        error_code: providerError.code,
      });
      await input.supabase.from("provider_connections").update({
        status: providerError.code === "rate_limited" ? "rate_limited" : "unavailable",
        last_checked_at: new Date().toISOString(),
        last_error: providerError.message,
      }).eq("id", connection.id).eq("user_id", input.userId);
      if (!shouldAttemptFallback(providerError, input.signal)) break;
    }
  }

  if (!attemptedProvider && lastError) {
    throw new AppError(lastError.message, 413, "CONTEXT_LIMIT");
  }
  throw new AppError(
    lastError?.message ?? "No eligible provider could answer the request",
    lastError?.code === "rate_limited" ? 429 : 502,
    lastError?.code.toUpperCase() ?? "PROVIDER_UNAVAILABLE",
  );
}
