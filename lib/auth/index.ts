import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthContext = {
  configured: boolean;
  user: User | null;
  supabase: SupabaseClient | null;
};

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  if (!isSupabaseConfigured()) {
    return { configured: false, user: null, supabase: null };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { configured: true, user: null, supabase };
  return { configured: true, user, supabase };
});

export async function requireAuth(): Promise<{
  user: User;
  supabase: SupabaseClient;
}> {
  const context = await getAuthContext();
  if (!context.configured) {
    throw new AppError("Supabase is not configured", 503, "SETUP_REQUIRED");
  }
  if (!context.user || !context.supabase) {
    throw new AppError("Sign in to continue", 401, "UNAUTHORIZED");
  }
  return { user: context.user, supabase: context.supabase };
}
