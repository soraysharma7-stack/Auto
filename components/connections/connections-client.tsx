"use client";

import { KeyRound, LoaderCircle, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/form-error";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { providerCatalog } from "@/lib/provider-catalog";
import type { AIMode, ProviderConnection, ProviderId } from "@/lib/types";

const inputClass = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-subtle";

export function ConnectionsClient({ initialConnections }: { initialConnections: ProviderConnection[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [priority, setPriority] = useState(50);
  const [supportedModes, setSupportedModes] = useState<AIMode[]>(["auto", "deep", "coding", "max", "student"]);
  const [contextLimitTokens, setContextLimitTokens] = useState(128_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addConnection(event: FormEvent) {
    event.preventDefault();
    setBusy("new");
    setError(null);
    try {
      const result = await apiRequest<{ connection: ProviderConnection }>("/api/connections", {
        method: "POST",
        body: JSON.stringify({ provider, model, apiKey, priority, supportedModes, contextLimitTokens }),
      });
      setConnections((current) => [result.connection, ...current]);
      setApiKey("");
      setModel("");
      setShowForm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection failed");
    } finally {
      setBusy(null);
    }
  }

  async function testConnection(connection: ProviderConnection) {
    setBusy(connection.id);
    setError(null);
    try {
      const result = await apiRequest<{ status: string; checkedAt: string }>(`/api/connections/${connection.id}/test`, { method: "POST" });
      setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "verified", last_checked_at: result.checkedAt, last_error: null } : item));
    } catch (caught) {
      setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "unavailable", last_checked_at: new Date().toISOString() } : item));
      setError(caught instanceof Error ? caught.message : "Verification failed");
    } finally {
      setBusy(null);
    }
  }

  async function removeConnection(connection: ProviderConnection) {
    if (!window.confirm(`Remove the ${providerCatalog[connection.provider].name} connection and its encrypted key?`)) return;
    setBusy(connection.id);
    setError(null);
    try {
      await apiRequest(`/api/connections/${connection.id}`, { method: "DELETE" });
      setConnections((current) => current.filter((item) => item.id !== connection.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white">
          <Plus aria-hidden="true" className="size-4" /> Add connection
        </button>
      </div>
      {showForm ? (
        <Card className="mb-6 p-5 sm:p-6">
          <h2 className="text-base font-semibold">Verify an official API connection</h2>
          <p className="mt-1 text-xs leading-5 text-muted">The provider is checked before the key is encrypted and saved. Nothing is returned to browser storage.</p>
          <form onSubmit={addConnection} className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="provider" className="mb-1.5 block text-xs font-medium">Provider</label>
              <select id="provider" value={provider} onChange={(event) => setProvider(event.target.value as ProviderId)} className={inputClass}>
                {Object.entries(providerCatalog).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="mb-1.5 block text-xs font-medium">Routing priority (1 is first)</label>
              <input id="priority" type="number" min={1} max={100} value={priority} onChange={(event) => setPriority(Number(event.target.value))} className={inputClass} />
            </div>
            {providerCatalog[provider].ai ? (
              <div className="md:col-span-2">
                <label htmlFor="model" className="mb-1.5 block text-xs font-medium">Model identifier</label>
                <input id="model" required value={model} onChange={(event) => setModel(event.target.value)} placeholder={providerCatalog[provider].modelPlaceholder} className={inputClass} />
              </div>
            ) : null}
            <div className="md:col-span-2">
              <label htmlFor="api-key" className="mb-1.5 block text-xs font-medium">Official API key</label>
              <input id="api-key" type="password" required minLength={8} autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Sent only to this Auto server over HTTPS" className={inputClass} />
            </div>
            <div>
              <label htmlFor="context-limit" className="mb-1.5 block text-xs font-medium">Declared context limit (tokens)</label>
              <input id="context-limit" type="number" min={4096} max={2000000} step={1024} value={contextLimitTokens} onChange={(event) => setContextLimitTokens(Number(event.target.value))} className={inputClass} />
            </div>
            <fieldset className="md:col-span-2"><legend className="mb-2 text-xs font-medium">Eligible task modes</legend><div className="flex flex-wrap gap-2">{(["auto", "deep", "coding", "max", "student"] as AIMode[]).map((mode) => <label key={mode} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs capitalize text-muted"><input type="checkbox" checked={supportedModes.includes(mode)} onChange={(event) => setSupportedModes((current) => event.target.checked ? [...current, mode] : current.filter((item) => item !== mode))} className="size-3.5 accent-[var(--brand)]" />{mode}</label>)}</div></fieldset>
            <div className="md:col-span-2"><FormError message={error} /></div>
            <div className="flex gap-3 md:col-span-2">
              <button type="submit" disabled={busy === "new"} className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                {busy === "new" ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Verify & encrypt
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">Cancel</button>
            </div>
          </form>
        </Card>
      ) : null}
      {!showForm ? <div className="mb-6"><FormError message={error} /></div> : null}

      {connections.length === 0 ? (
        <Card><EmptyState icon={Unplug} title="No services connected" description="Add an official provider above. Auto verifies it before reporting a connected status." className="py-14" /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {connections.map((connection) => (
            <Card key={connection.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{providerCatalog[connection.provider].name}</h2>
                  <p className="mt-1 break-all text-xs text-muted">{connection.model || "Web search"} · Priority {connection.priority}</p>
                </div>
                <StatusBadge status={connection.status} />
              </div>
              <dl className="mt-5 space-y-2 border-y border-line py-4 text-xs">
                <div className="flex justify-between gap-4"><dt className="text-subtle">Last checked</dt><dd className="text-muted">{formatDate(connection.last_checked_at)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-subtle">Credential</dt><dd className="text-muted">Encrypted · hidden</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-subtle">Context / latency</dt><dd className="text-muted">{connection.context_limit_tokens.toLocaleString()} tokens · {connection.latency_ms === null ? "Not measured" : `${connection.latency_ms} ms`}</dd></div>
              </dl>
              {connection.last_error ? <p className="mt-3 text-xs leading-5 text-warning">{connection.last_error}</p> : null}
              <div className="mt-4 flex items-center gap-2">
                <button type="button" disabled={busy === connection.id} onClick={() => testConnection(connection)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-50">
                  <RefreshCw aria-hidden="true" className={busy === connection.id ? "size-3.5 animate-spin" : "size-3.5"} /> Test again
                </button>
                <button type="button" disabled={busy === connection.id} onClick={() => removeConnection(connection)} aria-label={`Remove ${providerCatalog[connection.provider].name}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-warning hover:bg-warning-soft">
                  <Trash2 aria-hidden="true" className="size-3.5" /> Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs leading-5 text-subtle">Status is based on the latest real verification or request. “Verified” does not mean unlimited quota.</p>
      <Badge className="mt-3">Keys never appear in responses, exports or audit metadata</Badge>
    </>
  );
}
