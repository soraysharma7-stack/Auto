import { NextResponse } from "next/server";

import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { queueDeviceAction } from "@/lib/devices/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deviceActionSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth();
    const { id } = await context.params;
    const input = await parseJson(request, deviceActionSchema);
    const admin = createSupabaseAdminClient();
    const action = await queueDeviceAction(admin, user.id, input, id);
    await recordAudit(admin, { userId: user.id, action: "device_action.queued", resourceType: "device_action", resourceId: action.id, metadata: { deviceId: id, type: input.type } });
    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
