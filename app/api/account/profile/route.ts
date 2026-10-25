import { NextResponse } from "next/server";

import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { profileInputSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  try {
    const { user, supabase } = await requireAuth();
    const input = await parseJson(request, profileInputSchema);
    const { data, error } = await supabase.from("profiles").update({ display_name: input.displayName }).eq("id", user.id).select("id, display_name, preferences").single();
    if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
    const admin = createSupabaseAdminClient();
    await recordAudit(admin, { userId: user.id, action: "profile.updated", resourceType: "profile", resourceId: user.id });
    return NextResponse.json({ profile: data });
  } catch (error) {
    return handleApiError(error);
  }
}
