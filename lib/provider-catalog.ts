import type { ProviderId } from "@/lib/types";

export const providerCatalog: Record<ProviderId, { name: string; modelPlaceholder: string; ai: boolean }> = {
  gemini: { name: "Google Gemini", modelPlaceholder: "e.g. gemini-2.5-flash", ai: true },
  openai: { name: "OpenAI", modelPlaceholder: "e.g. gpt-4.1-mini", ai: true },
  anthropic: { name: "Anthropic", modelPlaceholder: "e.g. claude-sonnet-4-5", ai: true },
  tavily: { name: "Tavily Search", modelPlaceholder: "No model required", ai: false },
};
