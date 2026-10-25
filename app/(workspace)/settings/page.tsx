import { Palette } from "lucide-react";
import type { Metadata } from "next";

import { SettingsClient } from "@/components/settings/settings-client";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { SetupRequired } from "@/components/setup/setup-required";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await getAuthContext();
  if (!auth.user || !auth.supabase) return <SetupRequired feature="Settings" />;
  const { data: profile } = await auth.supabase.from("profiles").select("display_name").eq("id", auth.user.id).single();
  return <>
    <PageHeader eyebrow="Workspace preferences" title="Settings" description="Manage your real profile, appearance, data export, browser session and account deletion." />
    <div className="grid items-start gap-6 xl:grid-cols-[0.7fr_1.3fr]">
      <Card className="p-5 sm:p-6"><div className="mb-6 flex items-start justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Palette className="size-5" /></div><div><h2 className="text-base font-semibold">Appearance</h2><p className="text-xs text-muted">Saved in this browser.</p></div></div><Badge variant="success">Working</Badge></div><ThemeSettings /></Card>
      <SettingsClient email={auth.user.email ?? ""} initialName={profile?.display_name ?? ""} />
    </div>
  </>;
}
