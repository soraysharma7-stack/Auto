"use client";

import { Bot, Copy, LoaderCircle, Pencil, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/form-error";
import { agentTemplates } from "@/lib/agent-templates";
import { apiRequest } from "@/lib/client/api";
import { toolCatalog } from "@/lib/tool-catalog";
import type { Agent, AIProviderId, ToolName } from "@/lib/types";

const inputClass = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-subtle";
type FormState = {
  name: string;
  description: string;
  role: string;
  instructions: string;
  preferredProvider: AIProviderId | "";
  preferredModel: string;
  allowedTools: ToolName[];
  requiresApproval: boolean;
  maxOutputTokens: number;
};
const blank: FormState = {
  name: "", description: "", role: "General Assistant", instructions: "",
  preferredProvider: "", preferredModel: "", allowedTools: [], requiresApproval: true, maxOutputTokens: 2048,
};

export function AgentsClient({ initialAgents }: { initialAgents: Agent[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const [form, setForm] = useState<FormState>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function edit(agent: Agent) {
    setEditingId(agent.id);
    setForm({
      name: agent.name, description: agent.description, role: agent.role, instructions: agent.instructions,
      preferredProvider: agent.preferred_provider ?? "", preferredModel: agent.preferred_model ?? "",
      allowedTools: agent.allowed_tools, requiresApproval: agent.requires_approval, maxOutputTokens: agent.max_output_tokens,
    });
    setShowEditor(true);
    setError(null);
  }
  function duplicate(agent: Agent) {
    edit(agent);
    setEditingId(null);
    setForm((current) => ({ ...current, name: `Copy of ${agent.name}`.slice(0, 80) }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        preferredProvider: form.preferredProvider || null,
        preferredModel: form.preferredModel || null,
      };
      const result = await apiRequest<{ agent: Agent }>(editingId ? `/api/agents/${editingId}` : "/api/agents", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setAgents((current) => editingId ? current.map((agent) => agent.id === editingId ? result.agent : agent) : [result.agent, ...current]);
      setShowEditor(false);
      setEditingId(null);
      setForm(blank);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function remove(agent: Agent) {
    if (!window.confirm(`Delete ${agent.name}? Tasks assigned to it must be handled first.`)) return;
    setError(null);
    try {
      await apiRequest(`/api/agents/${agent.id}`, { method: "DELETE" });
      setAgents((current) => current.filter((item) => item.id !== agent.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed");
    }
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button type="button" onClick={() => { setForm(blank); setEditingId(null); setShowEditor(true); }} className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white">
          <Plus aria-hidden="true" className="size-4" /> New agent
        </button>
      </div>
      <FormError message={error} />
      {showEditor ? (
        <Card className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold">{editingId ? "Edit agent" : "Create agent"}</h2><p className="mt-1 text-xs text-muted">Instructions and tool limits are enforced by the execution worker.</p></div>
            <Badge variant="brand">Persistent configuration</Badge>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {agentTemplates.map((template) => (
              <button key={template.name} type="button" onClick={() => setForm((current) => ({ ...current, name: template.name, role: template.name, description: template.description, instructions: `${template.description}\n\nBe explicit about limitations and request only the tools you need.` }))} className="rounded-lg bg-surface-soft px-3 py-1.5 text-xs text-muted hover:text-ink">
                Use {template.name} template
              </button>
            ))}
          </div>
          <form onSubmit={save} className="mt-6 grid gap-4 md:grid-cols-2">
            <div><label htmlFor="agent-name" className="mb-1.5 block text-xs font-medium">Name</label><input id="agent-name" required minLength={2} maxLength={80} value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} /></div>
            <div><label htmlFor="agent-role" className="mb-1.5 block text-xs font-medium">Role</label><input id="agent-role" required minLength={2} maxLength={80} value={form.role} onChange={(e) => update("role", e.target.value)} className={inputClass} /></div>
            <div className="md:col-span-2"><label htmlFor="agent-description" className="mb-1.5 block text-xs font-medium">Description</label><input id="agent-description" maxLength={300} value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} /></div>
            <div className="md:col-span-2"><label htmlFor="agent-instructions" className="mb-1.5 block text-xs font-medium">Instructions</label><textarea id="agent-instructions" required minLength={10} maxLength={12000} rows={5} value={form.instructions} onChange={(e) => update("instructions", e.target.value)} className={inputClass} /></div>
            <div><label htmlFor="agent-provider" className="mb-1.5 block text-xs font-medium">Preferred provider</label><select id="agent-provider" value={form.preferredProvider} onChange={(e) => update("preferredProvider", e.target.value as AIProviderId | "")} className={inputClass}><option value="">Router decides</option><option value="gemini">Gemini</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></div>
            <div><label htmlFor="agent-model" className="mb-1.5 block text-xs font-medium">Preferred model (optional)</label><input id="agent-model" maxLength={160} value={form.preferredModel} onChange={(e) => update("preferredModel", e.target.value)} className={inputClass} /></div>
            <div><label htmlFor="agent-tokens" className="mb-1.5 block text-xs font-medium">Max output tokens per model turn</label><input id="agent-tokens" type="number" min={128} max={16384} value={form.maxOutputTokens} onChange={(e) => update("maxOutputTokens", Number(e.target.value))} className={inputClass} /></div>
            <label className="flex items-center gap-3 self-end rounded-xl border border-line px-3 py-3 text-xs text-muted"><input type="checkbox" checked={form.requiresApproval} onChange={(e) => update("requiresApproval", e.target.checked)} className="size-4 accent-[var(--brand)]" />Require approval for sensitive tools</label>
            <fieldset className="md:col-span-2"><legend className="mb-2 text-xs font-medium">Allowed tools</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(toolCatalog).map(([id, tool]) => <label key={id} className="flex items-start gap-2 rounded-xl border border-line p-3 text-xs text-muted"><input type="checkbox" checked={form.allowedTools.includes(id as ToolName)} onChange={(e) => update("allowedTools", e.target.checked ? [...form.allowedTools, id as ToolName] : form.allowedTools.filter((toolId) => toolId !== id))} className="mt-0.5 size-4 accent-[var(--brand)]" /><span><strong className="block font-medium text-ink">{tool.label}</strong><span className="mt-1 block leading-4">{tool.description}</span></span></label>)}</div></fieldset>
            <div className="flex gap-3 md:col-span-2"><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Save agent</button><button type="button" onClick={() => setShowEditor(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">Cancel</button></div>
          </form>
        </Card>
      ) : null}

      {agents.length === 0 ? <Card><EmptyState icon={Bot} title="No agents yet" description="Create a persistent agent with explicit instructions, model preferences and tool limits." className="py-14" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => <Card key={agent.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3"><div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Bot className="size-5" /></div><Badge variant={agent.requires_approval ? "brand" : "neutral"}>{agent.requires_approval ? "Approval gated" : "Auto tools"}</Badge></div>
            <h2 className="mt-4 text-base font-semibold">{agent.name}</h2><p className="mt-1 text-xs font-medium text-brand">{agent.role}</p><p className="mt-2 flex-1 text-xs leading-5 text-muted">{agent.description || "No description provided."}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{agent.allowed_tools.length ? agent.allowed_tools.map((tool) => <Badge key={tool}>{toolCatalog[tool]?.label ?? tool}</Badge>) : <Badge>No tools</Badge>}</div>
            <div className="mt-5 flex items-center gap-1 border-t border-line pt-4"><Link href={`/tasks?agent=${agent.id}`} className="rounded-lg bg-brand-soft px-3 py-2 text-xs font-medium text-brand-strong">Assign task</Link><button type="button" onClick={() => edit(agent)} aria-label={`Edit ${agent.name}`} className="ml-auto rounded-lg p-2 text-muted hover:bg-surface-soft"><Pencil className="size-4" /></button><button type="button" onClick={() => duplicate(agent)} aria-label={`Duplicate ${agent.name}`} className="rounded-lg p-2 text-muted hover:bg-surface-soft"><Copy className="size-4" /></button><button type="button" onClick={() => remove(agent)} aria-label={`Delete ${agent.name}`} className="rounded-lg p-2 text-warning hover:bg-warning-soft"><Trash2 className="size-4" /></button></div>
          </Card>)}
        </div>
      )}
    </>
  );
}
