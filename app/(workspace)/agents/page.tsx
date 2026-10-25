import type { Metadata } from "next";

import { AgentsClient } from "@/components/agents/agents-client";
import { SetupRequired } from "@/components/setup/setup-required";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import type { Agent } from "@/lib/types";

export const metadata: Metadata = { title: "AI Team" };

export default async function AgentsPage() {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="AI Team" />;
  const { data } = await auth.supabase.from("agents").select("*").neq("status", "archived").order("updated_at", { ascending: false });
  return <><PageHeader eyebrow="Agent workspace" title="AI Team" description="Create persistent agents with explicit instructions, eligible providers, tool limits and approval policy." /><AgentsClient initialAgents={(data ?? []) as Agent[]} /></>;
}
