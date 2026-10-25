import { NextResponse } from "next/server";

import { ProviderError } from "@/lib/ai/types";
import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { verifyProviderCredentials } from "@/lib/connections";
import { AppError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { encryptSecret } from "@/lib/security/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { connectionInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { supabase } = await requireAuth();
    const { data, error } = await supabase.from("provider_connections").select("*").order("created_at", { ascending: false });
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    return NextResponse.json({ connections: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth();
    const input = await parseJson(request, connectionInputSchema);
    const admin = createSupabaseAdminClient();
    await enforceRateLimit(admin, `connections:user:${user.id}`, 10, 900);
    try {
      await verifyProviderCredentials(input.provider, input.model, input.apiKey, request.signal);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw new AppError(error.message, error.code === "rate_limited" ? 429 : 422, "CONNECTION_VERIFICATION_FAILED");
      }
      throw error;
    }

    const { data: connection, error } = await admin.from("provider_connections").insert({
      user_id: user.id,
      provider: input.provider,
      model: input.provider === "tavily" ? "" : input.model,
      priority: input.priority,
      supported_modes: input.supportedModes,
      context_limit_tokens: input.contextLimitTokens,
      status: "verified",
      last_checked_at: new Date().toISOString(),
      last_error: null,
    }).select("*").single();
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");

    const { error: secretError } = await admin.from("provider_connection_secrets").insert({
      connection_id: connection.id,
      user_id: user.id,
      encrypted_key: encryptSecret(input.apiKey),
    });
    if (secretError) {
      await admin.from("provider_connections").delete().eq("id", connection.id).eq("user_id", user.id);
      throw new AppError("The encrypted credential could not be saved", 500, "DATABASE_ERROR");
    }
    await recordAudit(admin, { userId: user.id, action: "connection.created", resourceType: "provider_connection", resourceId: connection.id, metadata: { provider: input.provider } });
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
