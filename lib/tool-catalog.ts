import type { ToolName } from "@/lib/types";

export const toolCatalog: Record<ToolName, { label: string; description: string; approval: boolean }> = {
  web_search: { label: "Web search", description: "Verified Tavily requests with cited source URLs.", approval: false },
  read_file: { label: "Read workspace file", description: "Read only inside the isolated task workspace.", approval: false },
  write_file: { label: "Write workspace file", description: "Create or replace a file inside the task workspace.", approval: true },
  run_tests: { label: "Run sandbox tests", description: "Allowlisted commands in network-disabled Docker.", approval: true },
  device_action: { label: "Agent PC action", description: "Queue an action for a permitted active device session.", approval: true },
};
