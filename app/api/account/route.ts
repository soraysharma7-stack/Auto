import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  try {
    const { user, supabase } = await requireAuth();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new AppError("Account deletion failed", 500, "DELETE_FAILED");
    await supabase.auth.signOut();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
