"use client";

import { ChevronDown, ChevronUp, ListChecks, LoaderCircle, Play, Plus, RotateCcw, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/form-error";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import type { Agent, AIMode, Task } from "@/lib/types";

type Approval = { id: string; task_id: string; tool_name: string; tool_input: Record<string, unknown>; expires_at: string; status: string };
type Run = { id: string; attempt: number; status: string; progress: number; error: string | null; result: string | null; started_at: string; finished_at: string | null };
type Step = { id: string; kind: string; content: string; tool_name: string | null; tool_output: unknown; created_at: string };
const inputClass = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-subtle";

export function TasksClient({ agents, initialTasks, initialApprovals, initialAgentId }: { agents: Agent[]; initialTasks: Task[]; initialApprovals: Approval[]; initialAgentId?: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [agentId, setAgentId] = useState(initialAgentId && agents.some((agent) => agent.id === initialAgentId) ? initialAgentId : agents[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<AIMode>("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<{ runs: Run[]; steps: Step[] } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [taskResult, approvalResult] = await Promise.all([
        apiRequest<{ tasks: Task[] }>("/api/tasks"),
        apiRequest<{ approvals: Approval[] }>("/api/approvals"),
      ]);
      setTasks(taskResult.tasks);
      setApprovals(approvalResult.approvals);
    } catch {
      // Manual actions still surface errors; a background refresh never clears visible data.
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function createTask(event: FormEvent) {
    event.preventDefault();
    setBusy("new"); setError(null);
    try {
      const result = await apiRequest<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify({ agentId, description, mode }) });
      setTasks((current) => [result.task, ...current]);
      setDescription("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Task could not be created"); }
    finally { setBusy(null); }
  }
  async function action(task: Task, operation: "cancel" | "retry") {
    setBusy(task.id); setError(null);
    try {
      await apiRequest(`/api/tasks/${task.id}/${operation}`, { method: "POST" });
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Task update failed"); }
    finally { setBusy(null); }
  }
  async function decide(approval: Approval, decision: "approved" | "rejected") {
    setBusy(approval.id); setError(null);
    try {
      await apiRequest(`/api/approvals/${approval.id}`, { method: "POST", body: JSON.stringify({ decision }) });
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Approval update failed"); }
    finally { setBusy(null); }
  }
  async function toggleDetails(taskId: string) {
    if (expanded === taskId) { setExpanded(null); return; }
    setExpanded(taskId); setDetails(null);
    try {
      const result = await apiRequest<{ runs: Run[]; steps: Step[] }>(`/api/tasks/${taskId}`);
      setDetails({ runs: result.runs, steps: result.steps });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Logs could not be loaded"); }
  }

  return (
    <>
      <div className="grid items-start gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Assign a task</h2><p className="mt-1 text-xs leading-5 text-muted">It remains Queued until a real worker atomically claims it.</p>
            {agents.length ? <form onSubmit={createTask} className="mt-5 space-y-4">
              <div><label htmlFor="task-agent" className="mb-1.5 block text-xs font-medium">Agent</label><select id="task-agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputClass}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></div>
              <div><label htmlFor="task-mode" className="mb-1.5 block text-xs font-medium">Mode</label><select id="task-mode" value={mode} onChange={(e) => setMode(e.target.value as AIMode)} className={inputClass}><option value="auto">Auto</option><option value="deep">Deep thinking</option><option value="coding">Coding</option><option value="max">MAX</option><option value="student">Student</option></select></div>
              <div><label htmlFor="task-description" className="mb-1.5 block text-xs font-medium">Task description</label><textarea id="task-description" required minLength={3} maxLength={24000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the result you want…" className={inputClass} /></div>
              <p className="text-[11px] leading-5 text-subtle">Budget: at most {mode === "max" ? 20 : 12} model calls across retries and fallback. The task fails honestly when that limit is reached.</p>
              <FormError message={error} /><button type="submit" disabled={busy === "new"} className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy === "new" ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Queue task</button>
            </form> : <div className="mt-5"><p className="text-xs leading-5 text-muted">Create an agent before assigning work.</p><Link href="/agents" className="mt-3 inline-flex rounded-lg bg-brand-soft px-3 py-2 text-xs font-medium text-brand-strong">Create an agent</Link></div>}
          </Card>
          <Card className="p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /><h2 className="text-sm font-semibold">Pending approvals</h2><Badge>{approvals.length}</Badge></div>
            {approvals.length === 0 ? <p className="mt-4 text-xs leading-5 text-muted">No tool actions are waiting for a decision.</p> : <div className="mt-4 space-y-3">{approvals.map((approval) => <div key={approval.id} className="rounded-xl border border-line p-3"><div className="flex items-center justify-between gap-2"><code className="text-xs font-semibold">{approval.tool_name}</code><span className="text-[10px] text-subtle">Expires {formatDate(approval.expires_at)}</span></div><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-soft p-2 text-[10px] text-muted">{JSON.stringify(approval.tool_input, null, 2)}</pre><div className="mt-3 flex gap-2"><button type="button" disabled={busy === approval.id} onClick={() => decide(approval, "approved")} className="rounded-lg bg-brand-strong px-3 py-1.5 text-xs text-white">Approve & resume</button><button type="button" disabled={busy === approval.id} onClick={() => decide(approval, "rejected")} className="rounded-lg border border-line px-3 py-1.5 text-xs text-warning">Reject</button></div></div>)}</div>}
          </Card>
        </div>

        <Card>
          <div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">Task history</h2><p className="mt-0.5 text-xs text-muted">Updates automatically from durable records every five seconds.</p></div>
          {tasks.length === 0 ? <EmptyState icon={ListChecks} title="No tasks yet" description="Assign your first task. Its status will change only when the worker reports a valid transition." className="py-14" /> : <ul className="divide-y divide-line">{tasks.map((task) => <li key={task.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={task.status} /><Badge>{task.mode}</Badge><span className="text-[11px] text-subtle">{task.agents?.name ?? "Agent"}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{task.description}</p><p className="mt-2 text-[11px] text-subtle">Created {formatDate(task.created_at)}</p></div><div className="flex gap-1">
              {["queued", "running", "waiting_approval"].includes(task.status) ? <button type="button" disabled={busy === task.id} onClick={() => action(task, "cancel")} aria-label="Cancel task" className="rounded-lg p-2 text-warning hover:bg-warning-soft"><X className="size-4" /></button> : null}
              {["failed", "cancelled"].includes(task.status) ? <button type="button" disabled={busy === task.id} onClick={() => action(task, "retry")} aria-label="Retry task" className="rounded-lg p-2 text-brand hover:bg-brand-soft"><RotateCcw className="size-4" /></button> : null}
              <button type="button" onClick={() => toggleDetails(task.id)} aria-label="Toggle task logs" className="rounded-lg p-2 text-muted hover:bg-surface-soft">{expanded === task.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>
            </div></div>
            {task.error ? <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{task.error}</p> : null}{task.result ? <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-success-soft p-3 font-sans text-xs leading-5 text-ink">{task.result}</pre> : null}
            {expanded === task.id ? <div className="mt-4 rounded-xl border border-line bg-surface-soft/40 p-4">{!details ? <p className="flex items-center gap-2 text-xs text-muted"><LoaderCircle className="size-3.5 animate-spin" />Loading attempts…</p> : <><h3 className="text-xs font-semibold">Execution attempts</h3><div className="mt-2 space-y-2">{details.runs.map((run) => <div key={run.id} className="flex flex-wrap items-center gap-2 text-xs"><Badge>Attempt {run.attempt}</Badge><StatusBadge status={run.status} /><span className="text-subtle">{run.progress}%</span></div>)}</div><h3 className="mt-4 text-xs font-semibold">Recorded steps</h3><div className="mt-2 space-y-2">{details.steps.map((step) => <div key={step.id} className="rounded-lg bg-surface p-3 text-xs"><div className="flex gap-2"><Badge>{step.kind}</Badge>{step.tool_name ? <code>{step.tool_name}</code> : null}</div>{step.content ? <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted">{step.content}</pre> : null}{step.tool_output ? <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] text-subtle">{JSON.stringify(step.tool_output, null, 2)}</pre> : null}</div>)}</div></>}</div> : null}
          </li>)}</ul>}
        </Card>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs text-subtle"><Play className="size-3.5" />Run `npm run worker` on the worker host, or invoke the protected worker tick endpoint from a durable scheduler.</p>
    </>
  );
}
