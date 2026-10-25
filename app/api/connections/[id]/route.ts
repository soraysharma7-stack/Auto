import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAuth();
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("provider_connections").delete().eq("id", id).eq("user_id", user.id).select("id");
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    if (!data?.length) throw new AppError("Connection not found", 404, "NOT_FOUND");
    await recordAudit(admin, { userId: user.id, action: "connection.deleted", resourceType: "provider_connection", resourceId: id });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
