import { z } from "zod";

import { assertProviderResponse, providerFetch } from "@/lib/ai/providers/http";
import { ProviderError, type AIProviderAdapter } from "@/lib/ai/types";

const responseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([]),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional(),
});

export const anthropicProvider: AIProviderAdapter = {
  id: "anthropic",

  async verify(apiKey, model, signal) {
    if (!model) throw new ProviderError("An Anthropic model is required", "invalid_response", false);
    const response = await providerFetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    }, signal);
    await assertProviderResponse(response);
  },

  async generate(apiKey, request) {
    const response = await providerFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxOutputTokens,
        system: request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n") || undefined,
        messages: request.messages.filter((message) => message.role !== "system").map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    }, request.signal);
    await assertProviderResponse(response);
    const parsed = responseSchema.safeParse(await response.json());
    const text = parsed.success ? parsed.data.content.filter((part) => part.type === "text").map((part) => part.text ?? "").join("") : "";
    if (!parsed.success || !text) throw new ProviderError("Anthropic returned an invalid response", "invalid_response", false);
    return {
      text,
      provider: "anthropic",
      model: request.model,
      inputTokens: parsed.data.usage?.input_tokens,
      outputTokens: parsed.data.usage?.output_tokens,
    };
  },
};
