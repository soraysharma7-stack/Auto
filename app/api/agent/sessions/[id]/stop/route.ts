import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireDeviceAuth } from "@/lib/devices/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, deviceId, userId } = await requireDeviceAuth(request);
    const { id } = await context.params;
    await supabase.from("device_sessions").update({ status: "stopped", ended_at: new Date().toISOString() }).eq("id", id).eq("device_id", deviceId).eq("user_id", userId);
    await supabase.from("device_actions").update({ status: "cancelled", error: "Session stopped locally" }).eq("session_id", id).eq("device_id", deviceId).in("status", ["pending", "running"]);
    return NextResponse.json({ status: "stopped" });
  } catch (error) {
    return handleApiError(error);
  }
}
