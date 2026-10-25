import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireDeviceAuth } from "@/lib/devices/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, deviceId, userId } = await requireDeviceAuth(request);
    const { id } = await context.params;
    const { data: action } = await supabase.from("device_actions").select("*, device_sessions!inner(status)").eq("id", id).eq("device_id", deviceId).eq("user_id", userId).single();
    const session = action?.device_sessions as { status: string } | undefined;
    if (!action || session?.status !== "active") throw new AppError("Action is no longer available", 409, "ACTION_UNAVAILABLE");
    if (action.status !== "pending" || new Date(action.expires_at) <= new Date()) {
      throw new AppError("Action was already claimed or expired", 409, "ACTION_UNAVAILABLE");
    }
    const { data: claimed } = await supabase.from("device_actions").update({ status: "running" }).eq("id", id).eq("status", "pending").select("id, session_id, type, payload, status, expires_at").maybeSingle();
    if (!claimed) throw new AppError("Action was already claimed", 409, "ACTION_UNAVAILABLE");
    return NextResponse.json({ action: claimed });
  } catch (error) {
    return handleApiError(error);
  }
}
