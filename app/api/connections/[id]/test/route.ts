import { NextResponse } from "next/server";

import { ProviderError } from "@/lib/ai/types";
import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { verifyProviderCredentials } from "@/lib/connections";
import { AppError } from "@/lib/errors";
import { decryptSecret } from "@/lib/security/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let userId = "";
  let connectionId = "";
  try {
    const { user } = await requireAuth();
    admin = createSupabaseAdminClient();
    userId = user.id;
    const { id } = await context.params;
    connectionId = id;
    const { data: connection, error } = await admin.from("provider_connections").select("*").eq("id", id).eq("user_id", user.id).single();
    if (error || !connection) throw new AppError("Connection not found", 404, "NOT_FOUND");
    const { data: secret, error: secretError } = await admin.from("provider_connection_secrets").select("encrypted_key").eq("connection_id", id).eq("user_id", user.id).single();
    if (secretError || !secret) throw new AppError("Connection credential not found", 404, "NOT_FOUND");

    try {
      await verifyProviderCredentials(connection.provider, connection.model, decryptSecret(secret.encrypted_key), request.signal);
      await admin.from("provider_connections").update({ status: "verified", last_checked_at: new Date().toISOString(), last_error: null }).eq("id", id).eq("user_id", user.id);
      return NextResponse.json({ status: "verified", checkedAt: new Date().toISOString() });
    } catch (caught) {
      const providerError = caught instanceof ProviderError ? caught : new ProviderError("Verification failed", "provider_error", false);
      await admin.from("provider_connections").update({
        status: providerError.code === "rate_limited" ? "rate_limited" : "unavailable",
        last_checked_at: new Date().toISOString(),
        last_error: providerError.message,
      }).eq("id", id).eq("user_id", user.id);
      throw new AppError(providerError.message, 422, "CONNECTION_VERIFICATION_FAILED");
    }
  } catch (error) {
    if (admin && userId && connectionId && !(error instanceof AppError)) {
      await admin.from("provider_connections").update({ status: "unavailable", last_checked_at: new Date().toISOString() }).eq("id", connectionId).eq("user_id", userId);
    }
    return handleApiError(error);
  }
}
