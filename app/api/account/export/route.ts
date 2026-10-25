import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const tables = [
  "profiles", "agents", "conversations", "messages", "tasks", "agent_runs",
  "run_steps", "tool_approvals", "provider_connections", "usage_events",
  "audit_logs", "devices", "device_permissions", "device_sessions", "device_actions",
] as const;

export async function GET() {
  try {
    const { user, supabase } = await requireAuth();
    const entries = await Promise.all(tables.map(async (table) => {
      const ownerColumn = table === "profiles" ? "id" : "user_id";
      const selection = table === "provider_connections"
        ? "id,user_id,provider,model,priority,supported_modes,context_limit_tokens,latency_ms,status,last_checked_at,last_error,created_at,updated_at"
        : table === "devices"
          ? "id,user_id,name,app_version,status,paired_at,last_seen_at,created_at"
          : "*";
      const { data, error } = await supabase.from(table).select(selection).eq(ownerColumn, user.id);
      if (error) throw error;
      return [table, data ?? []];
    }));
    return new NextResponse(JSON.stringify({
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      data: Object.fromEntries(entries),
      notice: "Provider secrets and device credentials are never included in exports.",
    }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="auto-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
