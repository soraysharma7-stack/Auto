import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServiceRoleKey, getSupabaseConfig } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { url } = getSupabaseConfig();
  return createClient(url, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
