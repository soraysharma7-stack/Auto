import type { Metadata } from "next";

import { SetupRequired } from "@/components/setup/setup-required";
import { TasksClient } from "@/components/tasks/tasks-client";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import type { Agent, Task } from "@/lib/types";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="Task Manager" />;
  const [{ agent: requestedAgent }, { data: agents }, { data: tasks }, { data: approvals }] = await Promise.all([
    searchParams,
    auth.supabase.from("agents").select("*").eq("status", "active").order("name"),
    auth.supabase.from("tasks").select("*, agents(name)").order("created_at", { ascending: false }).limit(100),
    auth.supabase.from("tool_approvals").select("*").eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  return <><PageHeader eyebrow="Execution workspace" title="Task Manager" description="Queue durable work, inspect every attempt, approve sensitive tools and cancel or retry with valid state transitions." /><TasksClient agents={(agents ?? []) as Agent[]} initialTasks={(tasks ?? []) as Task[]} initialApprovals={approvals ?? []} initialAgentId={requestedAgent} /></>;
}
