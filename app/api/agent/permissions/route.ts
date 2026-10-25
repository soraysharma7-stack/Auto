import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseJson } from "@/lib/api";
import { requireDeviceAuth } from "@/lib/devices/auth";

const permissionsSchema = z.object({
  permissions: z.array(z.object({
    capability: z.enum(["screen", "input", "files"]),
    enabled: z.boolean(),
    paths: z.array(z.string().min(1).max(300)).max(20).default([]),
  })).max(3),
});

const actionTypes = {
  screen: ["screen_snapshot"],
  input: ["mouse_move", "mouse_click", "type_text"],
  files: ["read_file", "write_file"],
};

export async function PUT(request: Request) {
  try {
    const { supabase, deviceId, userId } = await requireDeviceAuth(request);
    const input = await parseJson(request, permissionsSchema);
    for (const permission of input.permissions) {
      await supabase.from("device_permissions").upsert({
        device_id: deviceId,
        user_id: userId,
        capability: permission.capability,
        enabled: permission.enabled,
        paths: permission.capability === "files" ? permission.paths : [],
      }, { onConflict: "device_id,capability" });
      if (!permission.enabled) {
        await supabase.from("device_actions").update({ status: "cancelled", error: "Local permission revoked" })
          .eq("device_id", deviceId).eq("user_id", userId).in("type", actionTypes[permission.capability]).in("status", ["pending", "running"]);
      }
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    return handleApiError(error);
  }
}
