import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const decisionSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth();
    const { id } = await context.params;
    const { decision } = await parseJson(request, decisionSchema);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("decide_tool_approval", {
      p_approval_id: id,
      p_user_id: user.id,
      p_decision: decision,
    });
    if (error) throw new AppError("Approval decision could not be saved", 500, "DATABASE_ERROR");
    const result = data?.[0] as { outcome: string; task_id: string; task_status: string } | undefined;
    if (!result) throw new AppError("Approval not found", 404, "NOT_FOUND");
    if (result.outcome === "closed") throw new AppError("This approval is no longer pending", 409, "APPROVAL_CLOSED");
    if (result.outcome === "expired") throw new AppError("This approval has expired", 410, "APPROVAL_EXPIRED");

    await recordAudit(admin, {
      userId: user.id,
      action: `approval.${decision}`,
      resourceType: "tool_approval",
      resourceId: id,
      metadata: { taskId: result.task_id },
    });
    return NextResponse.json({ status: decision, taskStatus: result.task_status });
  } catch (error) {
    return handleApiError(error);
  }
}
