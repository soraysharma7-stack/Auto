import { describe, expect, it } from "vitest";

import { agentTemplates } from "@/lib/agent-templates";

describe("planned agent templates", () => {
  it("has unique names and explicit capability descriptions", () => {
    const names = agentTemplates.map((template) => template.name);
    expect(new Set(names).size).toBe(names.length);

    for (const template of agentTemplates) {
      expect(template.description.length).toBeGreaterThan(20);
      expect(template.capabilities.length).toBeGreaterThan(0);
    }
  });
});
