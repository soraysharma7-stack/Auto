import { NextResponse } from "next/server";

import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { agentInputSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, supabase } = await requireAuth();
    const { id } = await context.params;
    const input = await parseJson(request, agentInputSchema);
    const { data, error } = await supabase.from("agents").update({
      name: input.name,
      description: input.description,
      role: input.role,
      instructions: input.instructions,
      preferred_provider: input.preferredProvider,
      preferred_model: input.preferredModel,
      allowed_tools: input.allowedTools,
      requires_approval: input.requiresApproval,
      max_output_tokens: input.maxOutputTokens,
    }).eq("id", id).eq("user_id", user.id).select("*").single();
    if (error) throw new AppError(error.message, error.code === "PGRST116" ? 404 : 500, "DATABASE_ERROR");
    const admin = createSupabaseAdminClient();
    await recordAudit(admin, { userId: user.id, action: "agent.updated", resourceType: "agent", resourceId: id });
    return NextResponse.json({ agent: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, supabase } = await requireAuth();
    const { id } = await context.params;
    const { data, error } = await supabase.from("agents").delete().eq("id", id).eq("user_id", user.id).select("id");
    if (error) throw new AppError("This agent still has tasks. Archive it or remove its tasks first.", 409, "AGENT_IN_USE");
    if (!data?.length) throw new AppError("Agent not found", 404, "NOT_FOUND");
    const admin = createSupabaseAdminClient();
    await recordAudit(admin, { userId: user.id, action: "agent.deleted", resourceType: "agent", resourceId: id });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
