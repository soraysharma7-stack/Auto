import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireDeviceAuth } from "@/lib/devices/auth";

const resultSchema = z.object({
  status: z.enum(["completed", "failed"]),
  result: z.record(z.string(), z.unknown()).default({}),
  error: z.string().max(1000).nullable().default(null),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, deviceId, userId } = await requireDeviceAuth(request);
    const { id } = await context.params;
    const input = await parseJson(request, resultSchema);
    if (JSON.stringify(input.result).length > 8_000_000) throw new AppError("Action result is too large", 413, "RESULT_TOO_LARGE");
    const { data: action } = await supabase.from("device_actions").select("id, status, device_sessions!inner(status)").eq("id", id).eq("device_id", deviceId).eq("user_id", userId).single();
    const session = action?.device_sessions as { status: string } | undefined;
    if (!action || action.status !== "running" || session?.status !== "active") {
      throw new AppError("Action is no longer running in an active session", 409, "ACTION_CLOSED");
    }
    await supabase.from("device_actions").update({ status: input.status, result: input.result, error: input.error }).eq("id", id);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return handleApiError(error);
  }
}
