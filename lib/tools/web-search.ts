import "server-only";

import { z } from "zod";

import { assertProviderResponse, providerFetch } from "@/lib/ai/providers/http";

const searchSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.url(),
    content: z.string().default(""),
  })).default([]),
});

export type SearchResult = { title: string; url: string; content: string };

export async function searchWeb(
  apiKey: string,
  query: string,
  maxResults = 5,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const response = await providerFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: maxResults, include_answer: false }),
  }, signal);
  await assertProviderResponse(response);
  const parsed = searchSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Search provider returned an invalid response");
  return parsed.data.results;
}

export async function verifyTavily(apiKey: string, signal?: AbortSignal): Promise<void> {
  await searchWeb(apiKey, "Auto connection verification", 1, signal);
}
