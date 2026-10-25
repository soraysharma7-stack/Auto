"use client";

import { Download, LoaderCircle, LogOut, Save, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/ui/form-error";
import { apiRequest } from "@/lib/client/api";

export function SettingsClient({ email, initialName }: { email: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      await apiRequest("/api/account/profile", { method: "PATCH", body: JSON.stringify({ displayName: name }) });
      setMessage("Profile saved."); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Profile could not be saved"); }
    finally { setBusy(false); }
  }
  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE" || !window.confirm("Permanently delete your Auto account and all owned records?")) return;
    setBusy(true); setError(null);
    try {
      await apiRequest("/api/account", { method: "DELETE" });
      router.push("/login"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Account deletion failed"); setBusy(false); }
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong"><UserRound className="size-5" /></div><div><h2 className="text-base font-semibold">Profile & account</h2><p className="text-xs text-muted">Your authenticated Supabase identity.</p></div></div><form onSubmit={saveProfile} className="mt-5 max-w-lg space-y-4"><div><label htmlFor="settings-email" className="mb-1.5 block text-xs font-medium">Email</label><input id="settings-email" value={email} disabled className="w-full rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-sm text-muted" /></div><div><label htmlFor="display-name" className="mb-1.5 block text-xs font-medium">Display name</label><input id="display-name" required minLength={1} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm" /></div><FormError message={error} />{message ? <p role="status" className="text-xs text-success">{message}</p> : null}<button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Save profile</button></form></section>
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6"><h2 className="text-base font-semibold">Data controls</h2><p className="mt-1 text-xs leading-5 text-muted">Export your records or permanently delete the account. Provider secrets and device tokens are never included in exports.</p><a href="/api/account/export" download className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted hover:text-ink"><Download className="size-4" />Export my data (JSON)</a></section>
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6"><h2 className="text-base font-semibold">Sign out</h2><p className="mt-1 text-xs text-muted">End this Supabase browser session.</p><form action="/api/auth/signout" method="post" className="mt-4"><button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted"><LogOut className="size-4" />Sign out</button></form></section>
    <section className="rounded-2xl border border-warning/20 bg-warning-soft p-5 sm:p-6"><h2 className="text-base font-semibold text-warning">Delete account</h2><p className="mt-1 text-xs leading-5 text-muted">This deletes the Supabase user and cascades through owned conversations, agents, tasks, connections, devices and audit records. It cannot be undone.</p><label htmlFor="delete-confirmation" className="mt-4 block text-xs font-medium">Type DELETE to confirm</label><input id="delete-confirmation" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="mt-2 w-full max-w-sm rounded-xl border border-line bg-surface px-3 py-2.5 text-sm" /><button type="button" onClick={deleteAccount} disabled={busy || deleteConfirmation !== "DELETE"} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"><Trash2 className="size-4" />Delete my account</button></section>
  </div>;
}
