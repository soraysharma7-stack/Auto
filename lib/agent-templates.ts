export type AgentTemplate = {
  name: string;
  description: string;
  capabilities: string[];
};

// Starting points for the real agent editor; users review and save each configuration.
export const agentTemplates: AgentTemplate[] = [
  {
    name: "Researcher",
    description: "Gather sources, compare findings and present cited summaries.",
    capabilities: ["Web research", "Source comparison", "Summaries"],
  },
  {
    name: "Developer",
    description: "Work inside approved projects with controlled editing and tests.",
    capabilities: ["Scoped files", "Code changes", "Test runs"],
  },
  {
    name: "Analyst",
    description: "Turn approved datasets into clear, traceable findings.",
    capabilities: ["Data review", "Calculations", "Reports"],
  },
  {
    name: "General Assistant",
    description: "Handle everyday questions and explicitly assigned work.",
    capabilities: ["Conversation", "Planning", "Drafting"],
  },
];
