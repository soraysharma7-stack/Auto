import { Activity, ArrowUpRight, Bot, CheckCircle2, ListChecks, MessageSquareText, PlugZap, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SetupRequired } from "@/components/setup/setup-required";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth";
import { formatDate } from "@/lib/client/format";
import type { Task } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="your Auto workspace" />;
  const [profile, agents, tasks, connections, activity] = await Promise.all([
    auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).single(),
    auth.supabase.from("agents").select("id", { count: "exact", head: true }).eq("status", "active"),
    auth.supabase.from("tasks").select("*, agents(name)").order("created_at", { ascending: false }).limit(6),
    auth.supabase.from("provider_connections").select("status"),
    auth.supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(6),
  ]);
  const taskRows = (tasks.data ?? []) as Task[];
  const verified = (connections.data ?? []).filter((connection) => connection.status === "verified").length;
  const displayName = profile.data?.display_name || auth.user.email?.split("@")[0] || "there";
  const metrics = [
    { label: "Active agents", value: String(agents.count ?? 0), detail: "Saved configurations", icon: Bot },
    { label: "Queued tasks", value: String(taskRows.filter((task) => task.status === "queued").length), detail: "Waiting for a worker", icon: ListChecks },
    { label: "Verified connections", value: String(verified), detail: `${connections.data?.length ?? 0} total configured`, icon: PlugZap },
    { label: "Completed in recent tasks", value: String(taskRows.filter((task) => task.status === "completed").length), detail: `Last ${taskRows.length} task records`, icon: CheckCircle2 },
  ];
  return <>
    <PageHeader eyebrow="Workspace overview" title={`Welcome back, ${displayName}`} description="Real activity across your agents, tasks, providers and paired devices—nothing pre-filled or simulated." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Card key={metric.label} className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{metric.label}</p><metric.icon className="size-4 text-brand" /></div><p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{metric.value}</p><p className="mt-1 text-[11px] text-subtle">{metric.detail}</p></Card>)}</div>
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="text-sm font-semibold">Recent tasks</h2><p className="mt-0.5 text-xs text-muted">Latest durable execution records.</p></div><Link href="/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-brand">View all<ArrowUpRight className="size-3.5" /></Link></div>
        {taskRows.length ? <ul className="divide-y divide-line">{taskRows.map((task) => <li key={task.id} className="px-5 py-4"><div className="flex items-center gap-2"><StatusBadge status={task.status} /><span className="text-[11px] text-subtle">{task.agents?.name}</span><span className="ml-auto text-[10px] text-subtle">{formatDate(task.created_at)}</span></div><p className="mt-2 line-clamp-2 text-sm text-ink">{task.description}</p></li>)}</ul> : <EmptyState icon={ListChecks} title="No tasks yet" description="Assign an agent its first task to begin a real execution record." className="py-10"><Link href="/tasks" className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2 text-xs font-medium text-white"><Plus className="size-3.5" />Create task</Link></EmptyState>}
      </Card>
      <div className="space-y-6">
        <Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Quick actions</h2><p className="mt-1 text-xs text-muted">Jump into a real workflow.</p></div></div><div className="mt-4 grid grid-cols-2 gap-3"><Link href="/chat" className="rounded-xl border border-line p-4 hover:bg-surface-soft"><MessageSquareText className="size-4 text-brand" /><span className="mt-3 block text-xs font-medium">New chat</span></Link><Link href="/agents" className="rounded-xl border border-line p-4 hover:bg-surface-soft"><Bot className="size-4 text-brand" /><span className="mt-3 block text-xs font-medium">Create agent</span></Link><Link href="/tasks" className="rounded-xl border border-line p-4 hover:bg-surface-soft"><ListChecks className="size-4 text-brand" /><span className="mt-3 block text-xs font-medium">Assign task</span></Link><Link href="/connections" className="rounded-xl border border-line p-4 hover:bg-surface-soft"><PlugZap className="size-4 text-brand" /><span className="mt-3 block text-xs font-medium">Add provider</span></Link></div></Card>
        <Card><div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">Recent activity</h2><Activity className="size-4 text-subtle" /></div>{activity.data?.length ? <ul className="divide-y divide-line">{activity.data.map((event) => <li key={event.id} className="px-5 py-3"><p className="text-xs font-medium">{event.action}</p><p className="mt-1 text-[10px] text-subtle">{event.resource_type} · {formatDate(event.created_at)}</p></li>)}</ul> : <div className="p-5"><p className="text-xs leading-5 text-muted">No audit events yet. Security and execution actions will appear here.</p><Badge className="mt-3">No sample entries</Badge></div>}</Card>
      </div>
    </div>
  </>;
}
