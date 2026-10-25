import { NextResponse } from "next/server";

import { handleApiError, requireWorkerAuthorization } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runNextTask } from "@/lib/tasks/worker";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    requireWorkerAuthorization(request);
    const supabase = createSupabaseAdminClient();
    await supabase.rpc("expire_stale_work");
    const processed = await runNextTask();
    return NextResponse.json({ processed });
  } catch (error) {
    return handleApiError(error);
  }
}
