import { z } from "zod";

import { assertProviderResponse, providerFetch } from "@/lib/ai/providers/http";
import { ProviderError, type AIProviderAdapter } from "@/lib/ai/types";

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).default([]),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).optional(),
});

export const openAIProvider: AIProviderAdapter = {
  id: "openai",

  async verify(apiKey, model, signal) {
    if (!model) throw new ProviderError("An OpenAI model is required", "invalid_response", false);
    const response = await providerFetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    }, signal);
    await assertProviderResponse(response);
  },

  async generate(apiKey, request) {
    const response = await providerFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_completion_tokens: request.maxOutputTokens,
      }),
    }, request.signal);
    await assertProviderResponse(response);
    const parsed = responseSchema.safeParse(await response.json());
    const text = parsed.success ? parsed.data.choices[0]?.message.content : null;
    if (!parsed.success || !text) throw new ProviderError("OpenAI returned an invalid response", "invalid_response", false);
    return {
      text,
      provider: "openai",
      model: request.model,
      inputTokens: parsed.data.usage?.prompt_tokens,
      outputTokens: parsed.data.usage?.completion_tokens,
    };
  },
};
