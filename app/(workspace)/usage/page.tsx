import { ChartNoAxesCombined, CircleAlert, Coins, Cpu } from "lucide-react";
import type { Metadata } from "next";

import { SetupRequired } from "@/components/setup/setup-required";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/client/format";

export const metadata: Metadata = { title: "Usage" };

type UsageEvent = { id: string; provider: string; model: string; kind: string; input_tokens: number | null; output_tokens: number | null; status: string; error_code: string | null; created_at: string };

export default async function UsagePage() {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="Usage" />;
  const { data } = await auth.supabase.from("usage_events").select("*").order("created_at", { ascending: false }).limit(500);
  const events = (data ?? []) as UsageEvent[];
  const inputTokens = events.reduce((sum, event) => sum + (event.input_tokens ?? 0), 0);
  const outputTokens = events.reduce((sum, event) => sum + (event.output_tokens ?? 0), 0);
  const failures = events.filter((event) => event.status === "failed").length;
  return <>
    <PageHeader eyebrow="Resource visibility" title="Usage" description="Actual application events and provider-reported token fields. Missing values stay unknown; quotas are never guessed." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-5"><ChartNoAxesCombined className="size-4 text-brand" /><p className="mt-4 text-3xl font-semibold">{events.length}</p><p className="mt-1 text-xs text-muted">Recorded events (latest 500 max)</p></Card>
      <Card className="p-5"><Cpu className="size-4 text-brand" /><p className="mt-4 text-3xl font-semibold">{formatNumber(inputTokens)}</p><p className="mt-1 text-xs text-muted">Reported input tokens</p></Card>
      <Card className="p-5"><Coins className="size-4 text-brand" /><p className="mt-4 text-3xl font-semibold">{formatNumber(outputTokens)}</p><p className="mt-1 text-xs text-muted">Reported output tokens</p></Card>
      <Card className="p-5"><CircleAlert className="size-4 text-brand" /><p className="mt-4 text-3xl font-semibold">{failures}</p><p className="mt-1 text-xs text-muted">Failed provider attempts</p></Card>
    </div>
    <Card className="mt-6 overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">Usage events</h2><p className="mt-0.5 text-xs text-muted">Newest first · token blanks mean the provider did not report them.</p></div>
      {events.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-surface-soft/50 text-subtle"><tr><th className="px-5 py-3 font-medium">Time (UTC)</th><th className="px-5 py-3 font-medium">Provider / model</th><th className="px-5 py-3 font-medium">Kind</th><th className="px-5 py-3 font-medium">Input</th><th className="px-5 py-3 font-medium">Output</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-line">{events.map((event) => <tr key={event.id}><td className="px-5 py-3 text-muted">{formatDate(event.created_at)}</td><td className="px-5 py-3"><p className="font-medium capitalize">{event.provider}</p><p className="mt-0.5 text-subtle">{event.model || "—"}</p></td><td className="px-5 py-3 capitalize text-muted">{event.kind}</td><td className="px-5 py-3">{formatNumber(event.input_tokens)}</td><td className="px-5 py-3">{formatNumber(event.output_tokens)}</td><td className="px-5 py-3"><StatusBadge status={event.status} />{event.error_code ? <p className="mt-1 text-[10px] text-warning">{event.error_code}</p> : null}</td></tr>)}</tbody></table></div> : <EmptyState icon={ChartNoAxesCombined} title="No usage events" description="Verified provider calls and searches will create real usage records here." className="py-14" />}
    </Card>
  </>;
}
