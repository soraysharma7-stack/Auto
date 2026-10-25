import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { buildAgentSystemPrompt } from "@/lib/ai/prompts";
import { generateWithRouter } from "@/lib/ai/router";
import type { AIMessage } from "@/lib/ai/types";
import { recordAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { assertToolAllowed } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toolRegistry, validateToolInput, type ToolContext } from "@/lib/tools/registry";
import { CodingSandbox } from "@/lib/tools/sandbox";
import { toolNameSchema } from "@/lib/validation";
import type { Agent, Task, ToolName } from "@/lib/types";

const agentTurnSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("final"), content: z.string().min(1).max(60_000) }),
  z.object({
    type: z.literal("tool"),
    tool: toolNameSchema,
    input: z.record(z.string(), z.unknown()),
  }),
]);

async function renewTaskLease(supabase: SupabaseClient, taskId: string): Promise<void> {
  await supabase.from("tasks").update({ lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString() })
    .eq("id", taskId).eq("status", "running");
}

async function taskIsCancelled(supabase: SupabaseClient, taskId: string): Promise<boolean> {
  const { data } = await supabase.from("tasks").select("status").eq("id", taskId).single();
  return data?.status === "cancelled";
}

export async function runNextTask(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_next_task");
  if (error) throw new AppError(error.message, 500, "WORKER_CLAIM_FAILED");
  const claim = data?.[0] as { task_id: string; run_id: string } | undefined;
  if (!claim) return false;
  await executeClaimedTask(supabase, claim.task_id, claim.run_id);
  return true;
}

async function executeClaimedTask(
  supabase: SupabaseClient,
  taskId: string,
  runId: string,
): Promise<void> {
  const controller = new AbortController();
  const cancellationWatcher = setInterval(async () => {
    if (await taskIsCancelled(supabase, taskId)) controller.abort();
  }, 2000);
  cancellationWatcher.unref();
  const sandbox = new CodingSandbox(taskId);
  let preserveWorkspace = false;

  try {
    const [{ data: task, error: taskError }, { data: previousSteps }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).single(),
      supabase.from("run_steps").select("kind, content, tool_name, tool_output").eq("task_id", taskId).order("created_at").limit(30),
    ]);
    if (taskError || !task) throw new AppError("Claimed task could not be loaded", 500, "DATABASE_ERROR");
    const typedTask = task as Task;
    const { data: agentData, error: agentError } = await supabase.from("agents").select("*").eq("id", typedTask.agent_id).eq("user_id", typedTask.user_id).single();
    if (agentError || !agentData) throw new AppError("The assigned agent is unavailable", 409, "AGENT_UNAVAILABLE");
    const agent = agentData as Agent;
    const context: ToolContext = {
      supabase,
      userId: typedTask.user_id,
      taskId,
      runId,
      sandbox,
      signal: controller.signal,
    };
    const messages: AIMessage[] = [
      {
        role: "system",
        content: buildAgentSystemPrompt({
          role: agent.role,
          instructions: agent.instructions,
          allowedTools: agent.allowed_tools,
          mode: typedTask.mode,
        }),
      },
      { role: "user", content: typedTask.description },
    ];
    for (const step of previousSteps ?? []) {
      if (step.kind === "model" && step.content) messages.push({ role: "assistant", content: step.content });
      if (step.kind === "tool") messages.push({ role: "user", content: `Previous ${step.tool_name} result:\n${JSON.stringify(step.tool_output)}` });
    }

    let stepNumber = 0;
    const saveStep = async (input: {
      kind: "model" | "tool" | "approval" | "error";
      content?: string;
      toolName?: string;
      toolInput?: Record<string, unknown>;
      toolOutput?: unknown;
    }) => {
      stepNumber += 1;
      await supabase.from("run_steps").insert({
        run_id: runId,
        task_id: taskId,
        user_id: typedTask.user_id,
        step_number: stepNumber,
        kind: input.kind,
        content: input.content ?? "",
        tool_name: input.toolName ?? null,
        tool_input: input.toolInput ?? null,
        tool_output: input.toolOutput === undefined ? null : input.toolOutput,
      });
    };

    const execute = async (toolName: ToolName, rawInput: Record<string, unknown>) => {
      assertToolAllowed(agent, toolName);
      const validated = validateToolInput(toolName, rawInput);
      if (["read_file", "write_file", "run_tests"].includes(toolName)) await sandbox.initialize();
      return toolRegistry[toolName].execute(context, validated);
    };

    // Resume exactly one user-approved action before asking the model for another turn.
    const { data: approved } = await supabase.from("tool_approvals").select("*")
      .eq("task_id", taskId).eq("user_id", typedTask.user_id).eq("status", "approved")
      .is("consumed_at", null).order("created_at").limit(1).maybeSingle();
    if (approved) {
      const parsedTool = toolNameSchema.parse(approved.tool_name);
      const output = await execute(parsedTool, approved.tool_input as Record<string, unknown>);
      await saveStep({ kind: "tool", toolName: parsedTool, toolInput: approved.tool_input, toolOutput: output });
      await supabase.from("tool_approvals").update({ consumed_at: new Date().toISOString() }).eq("id", approved.id);
      messages.push({ role: "user", content: `Approved ${parsedTool} result:\n${JSON.stringify(output)}` });
    }

    const maxSteps = typedTask.mode === "max" ? 10 : 6;
    for (let step = 0; step < maxSteps; step += 1) {
      await renewTaskLease(supabase, taskId);
      if (await taskIsCancelled(supabase, taskId) || controller.signal.aborted) {
        await supabase.from("agent_runs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", runId).in("status", ["running", "waiting_approval"]);
        return;
      }
      const { count: modelCalls, error: budgetError } = await supabase.from("usage_events")
        .select("id", { count: "exact", head: true }).eq("task_id", taskId).eq("kind", "task");
      if (budgetError) throw new AppError("Task budget could not be checked", 500, "DATABASE_ERROR");
      if ((modelCalls ?? 0) >= typedTask.max_model_calls) {
        throw new AppError(`Task reached its ${typedTask.max_model_calls}-call model budget`, 409, "MODEL_BUDGET_REACHED");
      }
      const response = await generateWithRouter({
        supabase,
        userId: typedTask.user_id,
        messages,
        mode: typedTask.mode,
        kind: "task",
        taskId,
        runId,
        preferredProvider: agent.preferred_provider,
        preferredModel: agent.preferred_model,
        maxOutputTokens: agent.max_output_tokens,
        signal: controller.signal,
      });
      messages.push({ role: "assistant", content: response.text });
      await saveStep({ kind: "model", content: response.text });
      const turn = agentTurnSchema.safeParse(JSON.parse(response.text));
      if (!turn.success) throw new AppError("The agent returned an invalid action envelope", 502, "INVALID_AGENT_RESPONSE");

      if (turn.data.type === "final") {
        const { data: completed, error: completionError } = await supabase.rpc("complete_task", {
          p_task_id: taskId,
          p_run_id: runId,
          p_result: turn.data.content,
        });
        if (completionError) throw new AppError("Task completion could not be saved", 500, "DATABASE_ERROR");
        if (completed) {
          await recordAudit(supabase, { userId: typedTask.user_id, action: "task.completed", resourceType: "task", resourceId: taskId, metadata: { runId, provider: response.provider, model: response.model } });
        }
        return;
      }

      const toolName = turn.data.tool;
      assertToolAllowed(agent, toolName);
      const toolInput = validateToolInput(toolName, turn.data.input);
      if (agent.requires_approval && toolRegistry[toolName].requiresApproval) {
        const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
        const { data: paused, error: approvalError } = await supabase.rpc("request_tool_approval", {
          p_task_id: taskId,
          p_run_id: runId,
          p_user_id: typedTask.user_id,
          p_tool_name: toolName,
          p_tool_input: toolInput,
          p_expires_at: expiresAt,
          p_progress: Math.round(((step + 1) / maxSteps) * 90),
        });
        if (approvalError) throw new AppError("Approval request could not be saved", 500, "DATABASE_ERROR");
        if (!paused) return;
        await saveStep({ kind: "approval", toolName, toolInput, content: "Approval requested" });
        preserveWorkspace = true;
        await recordAudit(supabase, { userId: typedTask.user_id, action: "approval.requested", resourceType: "task", resourceId: taskId, metadata: { runId, tool: toolName } });
        return;
      }

      const output = await execute(toolName, toolInput);
      await saveStep({ kind: "tool", toolName, toolInput, toolOutput: output });
      messages.push({ role: "user", content: `${toolName} result:\n${JSON.stringify(output)}` });
      await supabase.from("agent_runs").update({ progress: Math.round(((step + 1) / maxSteps) * 90) }).eq("id", runId).eq("status", "running");
      await renewTaskLease(supabase, taskId);
    }
    throw new AppError("The agent reached its step limit", 409, "STEP_LIMIT_REACHED");
  } catch (error) {
    const cancelled = controller.signal.aborted || await taskIsCancelled(supabase, taskId);
    const message = cancelled ? "Task cancelled" : error instanceof SyntaxError
      ? "The agent returned malformed JSON"
      : error instanceof Error ? error.message : "Task execution failed";
    if (cancelled) {
      await supabase.from("agent_runs").update({ status: "cancelled", error: "Task cancelled", finished_at: new Date().toISOString() })
        .eq("id", runId).in("status", ["running", "waiting_approval"]);
    } else {
      const { data: failed, error: failureError } = await supabase.rpc("fail_task", {
        p_task_id: taskId,
        p_run_id: runId,
        p_error: message.slice(0, 1000),
      });
      if (failureError) throw new AppError("Task failure could not be recorded", 500, "DATABASE_ERROR");
      if (failed) {
        const ownerId = (await supabase.from("tasks").select("user_id").eq("id", taskId).single()).data?.user_id;
        await supabase.from("run_steps").insert({ run_id: runId, task_id: taskId, user_id: ownerId, step_number: 999, kind: "error", content: message.slice(0, 1000) });
      }
    }
  } finally {
    clearInterval(cancellationWatcher);
    if (!preserveWorkspace) await sandbox.cleanup().catch(() => undefined);
  }
}
