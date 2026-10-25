import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireDeviceAuth } from "@/lib/devices/auth";

export async function POST(request: Request) {
  try {
    const { supabase, deviceId, userId } = await requireDeviceAuth(request);
    const { data: existing } = await supabase.from("device_sessions").select("*").eq("device_id", deviceId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (existing) {
      await supabase.from("device_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
      return NextResponse.json({ session: existing });
    }
    const { data: session, error } = await supabase.from("device_sessions").insert({ device_id: deviceId, user_id: userId }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
