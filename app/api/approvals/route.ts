import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const { user, supabase } = await requireAuth();
    const { data, error } = await supabase.from("tool_approvals").select("*").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false });
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    return NextResponse.json({ approvals: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
