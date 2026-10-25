import { ProviderError } from "@/lib/ai/types";

export async function providerFetch(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const signals = [signal, AbortSignal.timeout(45_000)].filter(
    (value): value is AbortSignal => Boolean(value),
  );
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.any(signals),
      cache: "no-store",
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new ProviderError("The request was cancelled", "cancelled", false);
    }
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ProviderError("The provider did not respond in time", "timeout", true);
    }
    throw new ProviderError("The provider could not be reached", "network", true);
  }
}

export async function assertProviderResponse(response: Response): Promise<void> {
  if (response.ok) return;
  let message = `Provider request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const candidate = typeof body.error === "string" ? body.error : body.error?.message ?? body.message;
    if (candidate) message = candidate.slice(0, 500);
  } catch {
    // Keep the status-only message when a provider returns a non-JSON error.
  }
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError("Provider authentication failed", "authentication", false, response.status);
  }
  if (response.status === 429) {
    throw new ProviderError("Provider rate limit reached", "rate_limited", true, response.status);
  }
  throw new ProviderError(
    message,
    "provider_error",
    response.status >= 500 || response.status === 408,
    response.status,
  );
}
