import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertValidTaskTransition } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth();
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const { data: task } = await admin.from("tasks").select("status").eq("id", id).eq("user_id", user.id).single();
    if (!task) throw new AppError("Task not found", 404, "NOT_FOUND");
    assertValidTaskTransition(task.status, "cancelled");
    const { data: updated } = await admin.from("tasks")
      .update({ status: "cancelled", error: "Cancelled by user", lease_expires_at: null })
      .eq("id", id).eq("user_id", user.id).in("status", ["queued", "running", "waiting_approval"]).select("id").maybeSingle();
    if (!updated) throw new AppError("Task state changed before cancellation", 409, "INVALID_TASK_TRANSITION");
    await admin.from("agent_runs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("task_id", id).eq("user_id", user.id).in("status", ["running", "waiting_approval"]);
    await admin.from("tool_approvals").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("task_id", id).eq("user_id", user.id).eq("status", "pending");
    await recordAudit(admin, { userId: user.id, action: "task.cancelled", resourceType: "task", resourceId: id });
    return NextResponse.json({ status: "cancelled" });
  } catch (error) {
    return handleApiError(error);
  }
}
