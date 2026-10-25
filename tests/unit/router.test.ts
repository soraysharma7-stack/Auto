import { describe, expect, it } from "vitest";

import { fitMessagesToContext, rankConnections, shouldAttemptFallback } from "@/lib/ai/router";
import { ProviderError } from "@/lib/ai/types";
import type { ProviderConnection } from "@/lib/types";

function connection(id: string, provider: "gemini" | "openai" | "anthropic", priority: number, model = "model"): ProviderConnection {
  return {
    id, user_id: "user", provider, model, priority, status: "verified",
    supported_modes: ["auto", "deep", "coding", "max", "student"], context_limit_tokens: 128000, latency_ms: null,
    last_checked_at: null, last_error: null, created_at: `2026-01-0${id}T00:00:00Z`, updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("AI routing policy", () => {
  it("prefers an exact provider and model before priority", () => {
    const ranked = rankConnections([
      connection("1", "gemini", 1),
      connection("2", "openai", 20, "preferred-model"),
      connection("3", "openai", 30),
    ], "openai", "preferred-model");
    expect(ranked.map((item) => item.id)).toEqual(["2", "3", "1"]);
  });

  it("uses user priority when there is no preference", () => {
    const ranked = rankConnections([connection("1", "gemini", 50), connection("2", "openai", 1)]);
    expect(ranked.map((item) => item.id)).toEqual(["2", "1"]);
  });

  it("keeps system instructions and the newest whole messages inside context", () => {
    const messages = [
      { role: "system" as const, content: "Rules" },
      { role: "user" as const, content: "old question" },
      { role: "assistant" as const, content: "old answer" },
      { role: "user" as const, content: "new question" },
    ];
    expect(fitMessagesToContext(messages, 20, 4)).toEqual(messages);
    expect(fitMessagesToContext(messages, 12, 4)?.at(-1)?.content).toBe("new question");
    expect(fitMessagesToContext(messages, 8, 4)).toBeNull();
  });

  it("falls back only for recoverable, non-cancelled failures", () => {
    expect(shouldAttemptFallback(new ProviderError("limited", "rate_limited", true))).toBe(true);
    expect(shouldAttemptFallback(new ProviderError("bad key", "authentication", false))).toBe(false);
    expect(shouldAttemptFallback(new ProviderError("network", "network", true), AbortSignal.abort())).toBe(false);
  });
});
