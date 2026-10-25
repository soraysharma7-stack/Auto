import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, supabase } = await requireAuth();
    const { id } = await context.params;
    const [{ data: task, error }, { data: runs }, { data: steps }, { data: approvals }] = await Promise.all([
      supabase.from("tasks").select("*, agents(name)").eq("id", id).eq("user_id", user.id).single(),
      supabase.from("agent_runs").select("*").eq("task_id", id).eq("user_id", user.id).order("attempt", { ascending: false }),
      supabase.from("run_steps").select("*").eq("task_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("tool_approvals").select("*").eq("task_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (error || !task) throw new AppError("Task not found", 404, "NOT_FOUND");
    return NextResponse.json({ task, runs: runs ?? [], steps: steps ?? [], approvals: approvals ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
