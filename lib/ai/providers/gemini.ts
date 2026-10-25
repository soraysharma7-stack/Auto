import { z } from "zod";

import { assertProviderResponse, providerFetch } from "@/lib/ai/providers/http";
import { ProviderError, type AIProviderAdapter } from "@/lib/ai/types";

const responseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).optional() }).optional(),
  })).default([]),
  usageMetadata: z.object({
    promptTokenCount: z.number().optional(),
    candidatesTokenCount: z.number().optional(),
  }).optional(),
});

export const geminiProvider: AIProviderAdapter = {
  id: "gemini",

  async verify(apiKey, model, signal) {
    if (!model) throw new ProviderError("A Gemini model is required", "invalid_response", false);
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
      { headers: { "x-goog-api-key": apiKey } },
      signal,
    );
    await assertProviderResponse(response);
  },

  async generate(apiKey, request) {
    const system = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: request.messages.filter((message) => message.role !== "system").map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: request.maxOutputTokens,
            ...(request.jsonResponse ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
      request.signal,
    );
    await assertProviderResponse(response);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new ProviderError("Gemini returned an invalid response", "invalid_response", false);
    const text = parsed.data.candidates[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) throw new ProviderError("Gemini returned no text", "invalid_response", false);
    return {
      text,
      provider: "gemini",
      model: request.model,
      inputTokens: parsed.data.usageMetadata?.promptTokenCount,
      outputTokens: parsed.data.usageMetadata?.candidatesTokenCount,
    };
  },
};
