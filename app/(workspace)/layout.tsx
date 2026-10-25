import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthContext } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();
  if (auth.configured && !auth.user) redirect("/login");
  return (
    <AppShell
      configured={auth.configured}
      userEmail={auth.user?.email ?? null}
    >
      {children}
    </AppShell>
  );
}
