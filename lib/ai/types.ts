import type { AIMode, AIProviderId } from "@/lib/types";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequest = {
  messages: AIMessage[];
  model: string;
  mode: AIMode;
  maxOutputTokens: number;
  signal?: AbortSignal;
};

export type AIResponse = {
  text: string;
  provider: AIProviderId;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type ProviderErrorCode =
  | "authentication"
  | "rate_limited"
  | "timeout"
  | "network"
  | "invalid_response"
  | "provider_error"
  | "cancelled";

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface AIProviderAdapter {
  id: AIProviderId;
  generate(apiKey: string, request: AIRequest): Promise<AIResponse>;
  verify(apiKey: string, model: string, signal?: AbortSignal): Promise<void>;
}
