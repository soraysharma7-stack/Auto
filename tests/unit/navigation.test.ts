import { describe, expect, it } from "vitest";

import { getPageTitle, navigationItems } from "@/lib/navigation";

const requiredRoutes = [
  "/dashboard",
  "/chat",
  "/agents",
  "/tasks",
  "/connections",
  "/agent-pc",
  "/usage",
  "/activity",
  "/settings",
];

describe("workspace navigation", () => {
  it("includes every workspace route", () => {
    expect(navigationItems.map((item) => item.href)).toEqual(
      expect.arrayContaining(requiredRoutes),
    );
  });

  it("uses unique, absolute internal routes", () => {
    const routes = navigationItems.map((item) => item.href);
    expect(new Set(routes).size).toBe(routes.length);
    for (const route of routes) {
      expect(route).toMatch(/^\/[a-z]/);
    }
  });

  it("resolves current and nested page titles", () => {
    expect(getPageTitle("/dashboard")).toBe("Dashboard");
    expect(getPageTitle("/agents/example-agent")).toBe("AI Team");
    expect(getPageTitle("/unknown")).toBe("Auto");
  });
});
