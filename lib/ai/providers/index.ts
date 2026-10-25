import { anthropicProvider } from "@/lib/ai/providers/anthropic";
import { geminiProvider } from "@/lib/ai/providers/gemini";
import { openAIProvider } from "@/lib/ai/providers/openai";
import type { AIProviderAdapter } from "@/lib/ai/types";
import type { AIProviderId } from "@/lib/types";

export const providerAdapters: Record<AIProviderId, AIProviderAdapter> = {
  gemini: geminiProvider,
  openai: openAIProvider,
  anthropic: anthropicProvider,
};
