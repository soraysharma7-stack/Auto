import { AppError } from "@/lib/errors";
import type { Agent, ToolName } from "@/lib/types";

export function assertOwner(ownerId: string, userId: string): void {
  if (ownerId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
}

export function assertToolAllowed(agent: Pick<Agent, "allowed_tools">, tool: ToolName): void {
  if (!agent.allowed_tools.includes(tool)) {
    throw new AppError(`The ${tool} tool is not allowed for this agent`, 403, "TOOL_NOT_ALLOWED");
  }
}

export function assertValidTaskTransition(from: string, to: string): void {
  const transitions: Record<string, string[]> = {
    queued: ["running", "cancelled"],
    running: ["waiting_approval", "completed", "failed", "cancelled"],
    waiting_approval: ["queued", "failed", "cancelled"],
    failed: ["queued"],
    completed: [],
    cancelled: ["queued"],
  };
  if (!transitions[from]?.includes(to)) {
    throw new AppError(`Task cannot move from ${from} to ${to}`, 409, "INVALID_TASK_TRANSITION");
  }
}
