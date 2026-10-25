import type { AIMode } from "@/lib/types";

export const agentResponseContract = `You are an Auto agent. Return exactly one JSON object with no markdown fence.
For a final answer: {"type":"final","content":"your complete answer"}.
For one allowed tool action: {"type":"tool","tool":"web_search|read_file|write_file|run_tests|device_action","input":{}}.
Never request a tool that is not in the allowed list. Never claim an action succeeded before its tool result is supplied.`;

export function buildAgentSystemPrompt(input: {
  role: string;
  instructions: string;
  allowedTools: string[];
  mode: AIMode;
}): string {
  return `${agentResponseContract}\nRole: ${input.role}\nMode: ${input.mode}\nAllowed tools: ${input.allowedTools.join(", ") || "none"}\nInstructions:\n${input.instructions}`;
}
