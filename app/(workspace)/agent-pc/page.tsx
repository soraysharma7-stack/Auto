import type { Metadata } from "next";

import { DevicesClient } from "@/components/agent-pc/devices-client";
import { SetupRequired } from "@/components/setup/setup-required";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import type { DeviceBundle } from "@/lib/device-types";
import type { Device } from "@/lib/types";

export const metadata: Metadata = { title: "Agent PC" };

export default async function AgentPcPage() {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="Agent PC" />;
  const [devices, permissions, sessions, actions] = await Promise.all([
    auth.supabase.from("devices").select("*").order("created_at", { ascending: false }),
    auth.supabase.from("device_permissions").select("*"),
    auth.supabase.from("device_sessions").select("*").order("started_at", { ascending: false }).limit(50),
    auth.supabase.from("device_actions").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const deviceRows = (devices.data ?? []) as Device[];
  return (
    <>
      <PageHeader
        eyebrow="Local control"
        title="Agent PC"
        description="Pair your own Windows computer, inspect local permissions and stop or revoke every active control session."
      />
      <DevicesClient
        initialData={{
          devices: deviceRows,
          permissions: permissions.data ?? [],
          sessions: sessions.data ?? [],
          actions: actions.data ?? [],
        } as DeviceBundle}
      />
    </>
  );
}
