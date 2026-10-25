import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { generatePairingCode, hashToken } from "@/lib/security/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const { user } = await requireAuth();
    const admin = createSupabaseAdminClient();
    await enforceRateLimit(admin, `pairing-code:user:${user.id}`, 5, 600);
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await admin.from("device_pairing_codes").update({ used_at: new Date().toISOString() }).eq("user_id", user.id).is("used_at", null);
    const { error } = await admin.from("device_pairing_codes").insert({ user_id: user.id, code_hash: hashToken(code), expires_at: expiresAt });
    if (error) throw error;
    await recordAudit(admin, { userId: user.id, action: "device_pairing_code.created", resourceType: "device_pairing" });
    return NextResponse.json({ code, expiresAt }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
