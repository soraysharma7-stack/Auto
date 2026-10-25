import "server-only";

import { providerAdapters } from "@/lib/ai/providers";
import type { ProviderId } from "@/lib/types";
import { verifyTavily } from "@/lib/tools/web-search";

export async function verifyProviderCredentials(
  provider: ProviderId,
  model: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<void> {
  if (provider === "tavily") {
    await verifyTavily(apiKey, signal);
    return;
  }
  await providerAdapters[provider].verify(apiKey, model, signal);
}
