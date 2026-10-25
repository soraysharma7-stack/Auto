import { NextResponse } from "next/server";

import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { taskInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { supabase } = await requireAuth();
    const { data, error } = await supabase.from("tasks").select("*, agents(name)").order("created_at", { ascending: false }).limit(100);
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    return NextResponse.json({ tasks: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireAuth();
    const input = await parseJson(request, taskInputSchema);
    const { data: agent, error: agentError } = await supabase.from("agents").select("id").eq("id", input.agentId).eq("user_id", user.id).eq("status", "active").single();
    if (agentError || !agent) throw new AppError("Select an active agent you own", 404, "AGENT_NOT_FOUND");
    const admin = createSupabaseAdminClient();
    await enforceRateLimit(admin, `tasks:user:${user.id}`, 20, 3600);
    const { data: task, error } = await admin.from("tasks").insert({
      user_id: user.id,
      agent_id: input.agentId,
      description: input.description,
      mode: input.mode,
      status: "queued",
      max_model_calls: input.mode === "max" ? 20 : 12,
    }).select("*, agents(name)").single();
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    await recordAudit(admin, { userId: user.id, action: "task.queued", resourceType: "task", resourceId: task.id });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
