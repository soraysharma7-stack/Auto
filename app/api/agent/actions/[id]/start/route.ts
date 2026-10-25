import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireDeviceAuth } from "@/lib/devices/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, deviceId, userId } = await requireDeviceAuth(request);
    const { id } = await context.params;
    const { data: action, error } = await supabase.rpc("claim_device_action", {
      p_action_id: id,
      p_device_id: deviceId,
      p_user_id: userId,
    });
    if (error) throw new AppError("Device action could not be claimed", 500, "DATABASE_ERROR");
    if (!action) throw new AppError("Action expired, was claimed, or no longer has an active session and permission", 409, "ACTION_UNAVAILABLE");
    return NextResponse.json({ action });
  } catch (error) {
    return handleApiError(error);
  }
}
