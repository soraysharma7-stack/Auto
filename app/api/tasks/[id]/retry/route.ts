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
    assertValidTaskTransition(task.status, "queued");
    const { data: updated } = await admin.from("tasks")
      .update({ status: "queued", error: null, result: null, lease_expires_at: null })
      .eq("id", id).eq("user_id", user.id).in("status", ["failed", "cancelled"]).select("id").maybeSingle();
    if (!updated) throw new AppError("Task state changed before retry", 409, "INVALID_TASK_TRANSITION");
    await recordAudit(admin, { userId: user.id, action: "task.retried", resourceType: "task", resourceId: id });
    return NextResponse.json({ status: "queued" });
  } catch (error) {
    return handleApiError(error);
  }
}
