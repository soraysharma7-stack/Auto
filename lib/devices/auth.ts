import "server-only";

import { AppError } from "@/lib/errors";
import { hashToken } from "@/lib/security/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requireDeviceAuth(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError("Device credentials are required", 401, "UNAUTHORIZED");
  }
  const token = authorization.slice(7);
  if (token.length < 32) throw new AppError("Invalid device credentials", 401, "UNAUTHORIZED");
  const supabase = createSupabaseAdminClient();
  const { data: credential } = await supabase.from("device_credentials")
    .select("device_id, user_id, devices!inner(status, name, app_version)")
    .eq("token_hash", hashToken(token)).single();
  const device = credential?.devices as { status: string } | undefined;
  if (!credential || device?.status !== "active") {
    throw new AppError("Device is unpaired or revoked", 401, "DEVICE_REVOKED");
  }
  return { supabase, deviceId: credential.device_id as string, userId: credential.user_id as string };
}
