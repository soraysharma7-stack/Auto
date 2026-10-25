"use client";

import { Camera, KeyRound, Laptop, LoaderCircle, MonitorCog, Power, RefreshCw, ShieldCheck, Square, Unplug } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/form-error";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { useNow } from "@/lib/client/use-now";
import type { DeviceBundle } from "@/lib/device-types";

export function DevicesClient({ initialData }: { initialData: DeviceBundle }) {
  const [data, setData] = useState(initialData);
  const now = useNow();
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await apiRequest<DeviceBundle>("/api/devices");
      setData(next);
    } catch {
      // Keep the last genuine device state visible if a background refresh fails.
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function createCode() {
    setBusy("pair"); setError(null);
    try { setPairing(await apiRequest<{ code: string; expiresAt: string }>("/api/devices/pairing-code", { method: "POST" })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Pairing code failed"); }
    finally { setBusy(null); }
  }
  async function stopSession(sessionId: string) {
    setBusy(sessionId); setError(null);
    try {
      await apiRequest(`/api/devices/sessions/${sessionId}/stop`, { method: "POST" });
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Session could not be stopped"); }
    finally { setBusy(null); }
  }
  async function revokeDevice(deviceId: string) {
    if (!window.confirm("Revoke this device? Its token, active sessions and pending actions will stop working.")) return;
    setBusy(deviceId); setError(null);
    try {
      await apiRequest(`/api/devices/${deviceId}/revoke`, { method: "POST" });
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Device could not be revoked"); }
    finally { setBusy(null); }
  }
  async function snapshot(deviceId: string, sessionId: string) {
    setBusy(sessionId); setError(null);
    try {
      await apiRequest(`/api/devices/${deviceId}/actions`, { method: "POST", body: JSON.stringify({ sessionId, type: "screen_snapshot", payload: {} }) });
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Snapshot could not be queued"); }
    finally { setBusy(null); }
  }

  const onlineIds = data.devices.filter((device) => device.last_seen_at && now > 0 && now - new Date(device.last_seen_at).getTime() < 75_000).map((device) => device.id);
  const activeSessions = data.sessions.filter((session) => session.status === "active");
  const snapshots = data.actions.filter((action) => action.type === "screen_snapshot" && action.status === "completed" && typeof action.result?.image === "string");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><Badge variant="brand">Windows companion · Tauri + Rust</Badge><p className="mt-2 text-xs text-muted">Pairing codes expire after ten minutes and work once.</p></div>
        <button type="button" onClick={createCode} disabled={busy === "pair"} className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy === "pair" ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Generate pairing code</button>
      </div>
      <FormError message={error} />
      {pairing ? <Card className="mb-6 border-brand/20 bg-brand-soft p-5"><p className="text-xs font-medium text-brand-strong">Enter this one-time code in Auto Agent PC</p><div className="mt-3 flex flex-wrap items-center gap-4"><code className="rounded-xl bg-surface px-4 py-3 text-2xl font-semibold tracking-[0.2em] text-ink">{pairing.code}</code><span className="text-xs text-muted">Expires {formatDate(pairing.expiresAt)}</span></div><p className="mt-3 text-xs text-muted">The companion receives a high-entropy device token. This code and the token are never shown again.</p></Card> : null}

      {activeSessions.length ? <Card className="mb-6 border-warning/20 bg-warning-soft p-5"><div className="flex items-center gap-2"><Power className="size-4 text-warning" /><h2 className="text-sm font-semibold">Active local sessions</h2></div><div className="mt-4 space-y-3">{activeSessions.map((session) => { const device = data.devices.find((item) => item.id === session.device_id); return <div key={session.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3"><span className="size-2 rounded-full bg-success" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{device?.name ?? "Paired PC"}</p><p className="text-[11px] text-muted">Started {formatDate(session.started_at)}</p></div><button type="button" onClick={() => snapshot(session.device_id, session.id)} disabled={busy === session.id || !data.permissions.some((p) => p.device_id === session.device_id && p.capability === "screen" && p.enabled)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-muted disabled:opacity-40"><Camera className="size-3.5" />Request snapshot</button><button type="button" onClick={() => stopSession(session.id)} disabled={busy === session.id} className="inline-flex items-center gap-1.5 rounded-lg bg-warning px-3 py-2 text-xs font-semibold text-white"><Square className="size-3.5" />Stop Agent</button></div>; })}</div></Card> : null}

      {data.devices.length === 0 ? <Card><EmptyState icon={MonitorCog} title="No paired computers" description="Build and start the Windows companion, then generate a one-time code here to pair your own PC." className="py-14" /></Card> : <div className="grid gap-4 lg:grid-cols-2">{data.devices.map((device) => {
        const permissions = data.permissions.filter((permission) => permission.device_id === device.id);
        const online = onlineIds.includes(device.id) && device.status === "active";
        return <Card key={device.id} className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Laptop className="size-5" /></div><div><h2 className="text-base font-semibold">{device.name}</h2><p className="text-xs text-muted">Companion {device.app_version}</p></div></div><StatusBadge status={device.status} /></div>
          <div className="mt-5 flex items-center gap-2 text-xs"><span className={online ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-subtle"} /><span className="text-muted">{online ? "Online now" : "Offline"}</span><span className="ml-auto text-subtle">Last seen {formatDate(device.last_seen_at)}</span></div>
          <div className="mt-4 space-y-2 border-t border-line pt-4">{permissions.map((permission) => <div key={permission.id} className="flex items-start gap-2 text-xs"><ShieldCheck className={permission.enabled ? "mt-0.5 size-3.5 text-success" : "mt-0.5 size-3.5 text-subtle"} /><span className="capitalize text-muted">{permission.capability}</span><span className="ml-auto text-subtle">{permission.enabled ? "Granted locally" : "Not granted"}</span></div>)}</div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4"><p className="text-[11px] text-subtle">Permissions are changed on the PC, not silently from the web.</p>{device.status === "active" ? <button type="button" onClick={() => revokeDevice(device.id)} disabled={busy === device.id} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-warning hover:bg-warning-soft"><Unplug className="size-3.5" />Revoke</button> : null}</div>
        </Card>;
      })}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent device actions</h2><p className="mt-1 text-xs text-muted">Actual queued and reported native results.</p></div><button type="button" onClick={() => refresh()} aria-label="Refresh devices" className="rounded-lg p-2 text-muted hover:bg-surface-soft"><RefreshCw className="size-4" /></button></div><div className="mt-4 space-y-2">{data.actions.length ? data.actions.slice(0, 10).map((action) => <div key={action.id} className="rounded-xl border border-line p-3"><div className="flex items-center gap-2"><code className="text-xs">{action.type}</code><span className="ml-auto"><StatusBadge status={action.status} /></span></div>{action.error ? <p className="mt-2 text-xs text-warning">{action.error}</p> : null}<p className="mt-2 text-[10px] text-subtle">{formatDate(action.created_at)}</p></div>) : <p className="text-xs text-muted">No device actions have been queued.</p>}</div></Card>
        <Card className="p-5"><h2 className="text-sm font-semibold">Latest screen snapshot</h2>{snapshots[0] ? <div className="mt-4 overflow-hidden rounded-xl border border-line"><Image src={`data:image/png;base64,${snapshots[0].result?.image}`} alt="Latest user-approved screen snapshot from the paired PC" width={1280} height={720} unoptimized className="h-auto w-full" /></div> : <div className="mt-4"><EmptyState icon={Camera} title="No snapshots" description="Start a local session, grant screen permission on the PC, then request a snapshot." className="py-8" /></div>}</Card>
      </div>
      <p className="mt-6 text-xs leading-5 text-subtle">Companion source is in `desktop-agent/`. Build it on Windows with its documented Tauri toolchain; no unverified installer is offered here.</p>
    </>
  );
}
