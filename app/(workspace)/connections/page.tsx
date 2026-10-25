import type { Metadata } from "next";

import { ConnectionsClient } from "@/components/connections/connections-client";
import { SetupRequired } from "@/components/setup/setup-required";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import type { ProviderConnection } from "@/lib/types";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="Connections" />;
  const { data } = await auth.supabase.from("provider_connections").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader eyebrow="Integration center" title="Connections" description="Verify official APIs, protect credentials and inspect the latest genuine connection result." />
      <ConnectionsClient initialConnections={(data ?? []) as ProviderConnection[]} />
    </>
  );
}
