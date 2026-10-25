import { Database, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function SetupRequired({ feature }: { feature: string }) {
  return (
    <Card className="mx-auto mt-8 max-w-3xl p-6 sm:p-9">
      <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <Database aria-hidden="true" className="size-5" />
      </div>
      <Badge variant="brand" className="mt-5">Configuration required</Badge>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.045em]">
        Connect Supabase to use {feature}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        This build contains the real application flows, but it does not invent an account,
        database, provider or worker when services are absent. Add the server environment
        variables, apply the migrations, then restart Auto.
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <KeyRound aria-hidden="true" className="size-4 text-brand" />
          <h2 className="mt-3 text-sm font-semibold">1. Configure</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Copy `.env.example` to `.env.local` and add your own values.</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <Database aria-hidden="true" className="size-4 text-brand" />
          <h2 className="mt-3 text-sm font-semibold">2. Migrate</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Apply the SQL migrations and run the RLS tests.</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <ShieldCheck aria-hidden="true" className="size-4 text-brand" />
          <h2 className="mt-3 text-sm font-semibold">3. Verify</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Run setup, build and browser checks before connecting providers.</p>
        </div>
      </div>
      <p className="mt-6 flex items-start gap-2 border-t border-line pt-5 text-xs leading-5 text-subtle">
        <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Full setup instructions are in README.md. No credentials have been requested or stored.
      </p>
    </Card>
  );
}
