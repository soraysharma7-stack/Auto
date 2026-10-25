import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth();
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    await admin.from("device_sessions").update({ status: "stopped", ended_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    await admin.from("device_actions").update({ status: "cancelled", error: "Session stopped" }).eq("session_id", id).eq("user_id", user.id).in("status", ["pending", "running"]);
    await recordAudit(admin, { userId: user.id, action: "device_session.stopped", resourceType: "device_session", resourceId: id });
    return NextResponse.json({ status: "stopped" });
  } catch (error) {
    return handleApiError(error);
  }
}
