import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAudit(
  supabase: SupabaseClient,
  input: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: input.userId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("Audit insert failed", { action: input.action, code: error.code });
}
