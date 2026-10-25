import { NextResponse } from "next/server";

import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { agentInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { supabase } = await requireAuth();
    const { data, error } = await supabase.from("agents").select("*").neq("status", "archived").order("updated_at", { ascending: false });
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    return NextResponse.json({ agents: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireAuth();
    const input = await parseJson(request, agentInputSchema);
    const { data, error } = await supabase.from("agents").insert({
      user_id: user.id,
      name: input.name,
      description: input.description,
      role: input.role,
      instructions: input.instructions,
      preferred_provider: input.preferredProvider,
      preferred_model: input.preferredModel,
      allowed_tools: input.allowedTools,
      requires_approval: input.requiresApproval,
      max_output_tokens: input.maxOutputTokens,
    }).select("*").single();
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    const admin = createSupabaseAdminClient();
    await recordAudit(admin, { userId: user.id, action: "agent.created", resourceType: "agent", resourceId: data.id });
    return NextResponse.json({ agent: data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
