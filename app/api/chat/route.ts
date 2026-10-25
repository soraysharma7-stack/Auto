import { NextResponse } from "next/server";

import { generateWithRouter } from "@/lib/ai/router";
import type { AIMessage } from "@/lib/ai/types";
import { handleApiError, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AIMode } from "@/lib/types";
import { chatInputSchema } from "@/lib/validation";

const modeInstructions: Record<AIMode, string> = {
  auto: "Give a clear, direct answer and state important uncertainty.",
  deep: "Reason carefully, compare interpretations and explain trade-offs without inventing sources.",
  coding: "Provide maintainable code, consider failure cases and include appropriate verification steps.",
  max: "Break the work into deliberate steps and give a thorough result within the requested budget.",
  student: "Teach clearly with intuitive explanations, examples and a short check for understanding.",
};

export async function POST(request: Request) {
  let conversationId: string | null = null;
  let userId = "";
  try {
    const { user } = await requireAuth();
    const admin = createSupabaseAdminClient();
    userId = user.id;
    await enforceRateLimit(admin, `chat:user:${user.id}`, 60, 3600);
    const input = await parseJson(request, chatInputSchema);
    conversationId = input.conversationId;

    if (conversationId) {
      const { data, error } = await admin.from("conversations").select("id").eq("id", conversationId).eq("user_id", user.id).single();
      if (error || !data) throw new AppError("Conversation not found", 404, "NOT_FOUND");
    } else {
      const { data, error } = await admin.from("conversations").insert({
        user_id: user.id,
        title: input.message.slice(0, 72),
        mode: input.mode,
      }).select("id").single();
      if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
      conversationId = data.id;
    }

    const { data: historyData, error: historyError } = await admin.from("messages")
      .select("role, content").eq("conversation_id", conversationId).eq("user_id", user.id).eq("status", "completed")
      .order("created_at", { ascending: false }).limit(20);
    if (historyError) throw new AppError(historyError.message, 500, "DATABASE_ERROR");
    const history = (historyData ?? []).reverse() as AIMessage[];

    const { data: userMessage, error: messageError } = await admin.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: input.message,
    }).select("*").single();
    if (messageError) throw new AppError(messageError.message, 500, "DATABASE_ERROR");

    try {
      const response = await generateWithRouter({
        supabase: admin,
        userId: user.id,
        messages: [
          { role: "system", content: `You are Auto. ${modeInstructions[input.mode]}` },
          ...history,
          { role: "user", content: input.message },
        ],
        mode: input.mode,
        kind: "chat",
        maxOutputTokens: input.mode === "max" || input.mode === "deep" ? 4096 : 2048,
        signal: request.signal,
      });
      const { data: assistantMessage, error } = await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: response.text,
        provider: response.provider,
        model: response.model,
        input_tokens: response.inputTokens ?? null,
        output_tokens: response.outputTokens ?? null,
      }).select("*").single();
      if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
      await admin.from("conversations").update({ mode: input.mode }).eq("id", conversationId).eq("user_id", user.id);
      await recordAudit(admin, { userId: user.id, action: "chat.completed", resourceType: "conversation", resourceId: conversationId ?? undefined, metadata: { provider: response.provider, model: response.model } });
      return NextResponse.json({ conversationId, userMessage, assistantMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The provider request failed";
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: "",
        status: "failed",
        error: message,
      });
      throw error;
    }
  } catch (error) {
    const response = handleApiError(error);
    if (conversationId && userId) {
      const body = (await response.json()) as { error: string; code: string };
      return NextResponse.json({ ...body, conversationId }, { status: response.status });
    }
    return response;
  }
}
