import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import { hashToken } from "@/lib/security/secrets";

export async function enforceRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_rate_key: hashToken(key),
    p_rate_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new AppError("Rate-limit state could not be checked", 500, "RATE_LIMIT_UNAVAILABLE");
  if (data !== true) throw new AppError("Request limit reached. Try again later.", 429, "RATE_LIMITED");
}

export function requestRateKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const identity = forwarded || "local";
  return `${scope}:ip:${identity}`;
}
