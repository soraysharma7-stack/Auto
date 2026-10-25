import { afterEach, describe, expect, it, vi } from "vitest";

import { anthropicProvider } from "@/lib/ai/providers/anthropic";
import { geminiProvider } from "@/lib/ai/providers/gemini";
import { openAIProvider } from "@/lib/ai/providers/openai";

const request = {
  messages: [{ role: "user" as const, content: "Hello" }],
  model: "test-model",
  mode: "auto" as const,
  maxOutputTokens: 100,
};

afterEach(() => vi.unstubAllGlobals());

describe("official provider adapters", () => {
  it("normalizes Gemini text and token usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Hello " }, { text: "world" }] } }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await geminiProvider.generate("secret", request);
    expect(response).toMatchObject({ text: "Hello world", provider: "gemini", inputTokens: 3, outputTokens: 2 });
    expect(fetchMock.mock.calls[0][0]).toContain("test-model:generateContent");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("secret");
  });

  it("normalizes Anthropic content blocks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "A clear answer" }],
      usage: { input_tokens: 4, output_tokens: 3 },
    }), { status: 200 })));
    const response = await anthropicProvider.generate("secret", request);
    expect(response).toMatchObject({ text: "A clear answer", provider: "anthropic", inputTokens: 4, outputTokens: 3 });
  });

  it("uses OpenAI JSON mode for structured task envelopes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"type":"final","content":"Done"}' } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await openAIProvider.generate("secret", { ...request, jsonResponse: true });
    expect(JSON.parse(response.text)).toEqual({ type: "final", content: "Done" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("uses a forced Anthropic response tool for structured task envelopes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "tool_use", name: "auto_agent_response", input: { type: "final", content: "Done" } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await anthropicProvider.generate("secret", { ...request, jsonResponse: true });
    expect(JSON.parse(response.text)).toEqual({ type: "final", content: "Done" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.tool_choice).toEqual({ type: "tool", name: "auto_agent_response" });
  });

  it("marks OpenAI authentication failures as non-retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid key" } }), { status: 401 })));
    await expect(openAIProvider.generate("bad", request)).rejects.toMatchObject({ code: "authentication", retryable: false });
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 })));
    await expect(geminiProvider.generate("secret", request)).rejects.toMatchObject({ code: "invalid_response", retryable: false });
  });
});
