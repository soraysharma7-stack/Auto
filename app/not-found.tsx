import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <Card className="w-full max-w-2xl">
      <EmptyState
        icon={Compass}
        title="This page doesn’t exist"
        description="The route may have changed, or it may not have been built yet. Return to the dashboard to keep exploring Auto."
        className="py-16"
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to dashboard
        </Link>
        </EmptyState>
      </Card>
    </main>
  );
}
