import { access, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { CodingSandbox, resolveSandboxPath } from "@/lib/tools/sandbox";

afterEach(() => vi.unstubAllEnvs());

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

  it("writes normally but rejects intermediate symlinks before creating anything outside", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "auto-sandbox-test-"));
    vi.stubEnv("AUTO_SANDBOX_ENABLED", "true");
    vi.stubEnv("AUTO_SANDBOX_ROOT", base);
    try {
      const sandbox = new CodingSandbox("10000000-0000-4000-8000-000000000001");
      await sandbox.initialize();
      await sandbox.write("src/example.ts", "safe");
      await expect(sandbox.read("src/example.ts")).resolves.toBe("safe");

      const outside = path.join(base, "outside");
      await mkdir(outside);
      await symlink(outside, path.join(sandbox.root, "linked"), "dir");
      await expect(sandbox.write("linked/new/escape.txt", "unsafe")).rejects.toThrow("symlinks");
      await expect(access(path.join(outside, "new"))).rejects.toThrow();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
