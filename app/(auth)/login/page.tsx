import { ArrowRight, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const auth = await getAuthContext();
  if (auth.user) redirect("/dashboard");

  return (
    <Card className="p-7 sm:p-9">
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <LockKeyhole aria-hidden="true" className="size-5" />
      </div>
      <Badge variant="brand">{auth.configured ? "Secure account access" : "Configuration required"}</Badge>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.045em]">
        {auth.configured ? "Welcome to Auto" : "Connect Supabase first"}
      </h1>
      <p className="mb-7 mt-3 text-sm leading-6 text-muted">
        {auth.configured
          ? "Sign in or create an account to access your private agents, conversations, tasks and devices."
          : "The real sign-in flow is ready, but it will not collect credentials until Supabase is configured."}
      </p>
      {auth.configured ? <LoginForm /> : (
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white">
          View setup instructions <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </Card>
  );
}
