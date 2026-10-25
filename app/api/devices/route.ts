import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const { user, supabase } = await requireAuth();
    const [devices, permissions, sessions, actions] = await Promise.all([
      supabase.from("devices").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("device_permissions").select("*").eq("user_id", user.id),
      supabase.from("device_sessions").select("*").eq("user_id", user.id).order("started_at", { ascending: false }).limit(50),
      supabase.from("device_actions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    const failure = [devices.error, permissions.error, sessions.error, actions.error].find(Boolean);
    if (failure) throw new AppError(failure.message, 500, "DATABASE_ERROR");
    return NextResponse.json({
      devices: devices.data ?? [],
      permissions: permissions.data ?? [],
      sessions: sessions.data ?? [],
      actions: actions.data ?? [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
