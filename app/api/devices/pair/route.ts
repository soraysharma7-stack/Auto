import { NextResponse } from "next/server";

import { handleApiError, parseJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, requestRateKey } from "@/lib/security/rate-limit";
import { hashToken, randomToken } from "@/lib/security/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { pairingInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, pairingInputSchema);
    const admin = createSupabaseAdminClient();
    await enforceRateLimit(admin, requestRateKey(request, "device-pair"), 20, 600);
    const { data: pairing } = await admin.from("device_pairing_codes").select("*").eq("code_hash", hashToken(input.code.toUpperCase())).maybeSingle();
    if (!pairing || pairing.used_at || pairing.attempts >= 5) {
      throw new AppError("Invalid or expired pairing code", 401, "PAIRING_REJECTED");
    }
    if (new Date(pairing.expires_at) <= new Date()) {
      throw new AppError("Invalid or expired pairing code", 410, "PAIRING_EXPIRED");
    }
    const { data: claimed } = await admin.from("device_pairing_codes").update({ used_at: new Date().toISOString(), attempts: pairing.attempts + 1 })
      .eq("id", pairing.id).is("used_at", null).select("id").maybeSingle();
    if (!claimed) throw new AppError("This pairing code was already used", 409, "PAIRING_REJECTED");

    const token = randomToken();
    const { data: device, error } = await admin.from("devices").insert({
      user_id: pairing.user_id,
      name: input.deviceName,
      app_version: input.appVersion,
    }).select("id, user_id, name, app_version, paired_at").single();
    if (error) throw new AppError("Device could not be paired", 500, "DATABASE_ERROR");
    const { error: credentialError } = await admin.from("device_credentials").insert({
      device_id: device.id,
      user_id: pairing.user_id,
      token_hash: hashToken(token),
    });
    if (credentialError) {
      await admin.from("devices").delete().eq("id", device.id);
      throw new AppError("Device credentials could not be created", 500, "DATABASE_ERROR");
    }
    await admin.from("device_permissions").insert(["screen", "input", "files"].map((capability) => ({
      device_id: device.id,
      user_id: pairing.user_id,
      capability,
      enabled: false,
      paths: [],
    })));
    await recordAuditSafe(admin, pairing.user_id, device.id);
    return NextResponse.json({ device, deviceToken: token }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

async function recordAuditSafe(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, deviceId: string) {
  await supabase.from("audit_logs").insert({ user_id: userId, action: "device.paired", resource_type: "device", resource_id: deviceId });
}
