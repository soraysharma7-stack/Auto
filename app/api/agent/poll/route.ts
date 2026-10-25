import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseJson } from "@/lib/api";
import { requireDeviceAuth } from "@/lib/devices/auth";

const pollSchema = z.object({ sessionId: z.uuid().nullable().default(null) });

export async function POST(request: Request) {
  try {
    const { supabase, deviceId, userId } = await requireDeviceAuth(request);
    const input = await parseJson(request, pollSchema);
    const now = new Date().toISOString();
    await supabase.from("devices").update({ last_seen_at: now }).eq("id", deviceId).eq("user_id", userId);
    if (!input.sessionId) return NextResponse.json({ session: null, actions: [] });
    const { data: session } = await supabase.from("device_sessions").select("*").eq("id", input.sessionId).eq("device_id", deviceId).eq("user_id", userId).maybeSingle();
    if (!session || session.status !== "active") {
      return NextResponse.json({ session: session ?? null, actions: [] });
    }
    await supabase.from("device_sessions").update({ last_seen_at: now }).eq("id", session.id);
    const { data: actions, error } = await supabase.from("device_actions").select("id, session_id, type, payload, status, expires_at, created_at")
      .eq("device_id", deviceId).eq("session_id", session.id).eq("status", "pending").gt("expires_at", now).order("created_at");
    if (error) throw error;
    return NextResponse.json({ session, actions: actions ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
