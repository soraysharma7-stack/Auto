import { describe, expect, it } from "vitest";

import { resolveSandboxPath } from "@/lib/tools/sandbox";

describe("coding sandbox paths", () => {
  it("resolves ordinary relative workspace files", () => {
    expect(resolveSandboxPath("/tmp/auto", "src/example.ts")).toBe("/tmp/auto/src/example.ts");
    expect(resolveSandboxPath("/tmp/auto", "src/../example.ts")).toBe("/tmp/auto/example.ts");
  });

  it("rejects traversal, absolute paths and null bytes", () => {
    expect(() => resolveSandboxPath("/tmp/auto", "../secret")).toThrow("escape");
    expect(() => resolveSandboxPath("/tmp/auto", "/etc/passwd")).toThrow("relative");
    expect(() => resolveSandboxPath("/tmp/auto", "C:\\Windows\\system.ini")).toThrow("relative");
    expect(() => resolveSandboxPath("/tmp/auto", "bad\0path")).toThrow("relative");
  });
});
