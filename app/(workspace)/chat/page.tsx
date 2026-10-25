import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatInterface } from "@/components/chat/chat-interface";
import { SetupRequired } from "@/components/setup/setup-required";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import type { Conversation, Message } from "@/lib/types";

export const metadata: Metadata = { title: "AI Chat" };

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="AI Chat" />;
  const { conversation: requestedId } = await searchParams;
  const [{ data: conversations }, { data: active }, { data: providers }] = await Promise.all([
    auth.supabase.from("conversations").select("*").order("updated_at", { ascending: false }),
    requestedId ? auth.supabase.from("conversations").select("*").eq("id", requestedId).eq("user_id", auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
    auth.supabase.from("provider_connections").select("id").eq("status", "verified").neq("provider", "tavily").limit(1),
  ]);
  if (requestedId && !active) notFound();
  const { data: messages } = active
    ? await auth.supabase.from("messages").select("*").eq("conversation_id", active.id).order("created_at")
    : { data: [] };
  return <><PageHeader eyebrow="AI workspace" title="AI Chat" description="Persistent conversations with official providers, honest errors, cancellation and the actual model identity on every answer." /><ChatInterface key={active?.id ?? "new"} conversations={(conversations ?? []) as Conversation[]} activeConversation={active as Conversation | null} initialMessages={(messages ?? []) as Message[]} hasProvider={Boolean(providers?.length)} /></>;
}
