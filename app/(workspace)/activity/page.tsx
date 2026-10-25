import { Activity, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { SetupRequired } from "@/components/setup/setup-required";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { getAuthContext } from "@/lib/auth";
import { formatDate } from "@/lib/client/format";

export const metadata: Metadata = { title: "Activity" };

type AuditEvent = { id: string; action: string; resource_type: string; resource_id: string | null; metadata: Record<string, unknown>; created_at: string };

export default async function ActivityPage() {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="Activity" />;
  const { data } = await auth.supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  const events = (data ?? []) as AuditEvent[];
  return <>
    <PageHeader eyebrow="Audit history" title="Activity" description="User-scoped security, connection, agent, task, approval and device events with secret-free metadata." />
    <Card><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="text-sm font-semibold">Event history</h2><p className="mt-0.5 text-xs text-muted">Latest 200 events · newest first</p></div><Badge>{events.length} records</Badge></div>
      {events.length ? <ol className="divide-y divide-line">{events.map((event) => <li key={event.id} className="flex gap-4 px-5 py-4"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong"><ShieldCheck className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{event.action}</h3><Badge>{event.resource_type}</Badge></div><p className="mt-1 text-[11px] text-subtle">{formatDate(event.created_at)} UTC{event.resource_id ? ` · ${event.resource_id}` : ""}</p>{Object.keys(event.metadata).length ? <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-soft p-2 text-[10px] text-muted">{JSON.stringify(event.metadata, null, 2)}</pre> : null}</div></li>)}</ol> : <EmptyState icon={Activity} title="No audit events" description="Real account, connection, execution and device actions will create inspectable records here." className="py-14" />}
    </Card>
  </>;
}
