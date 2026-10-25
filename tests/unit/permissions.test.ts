import { describe, expect, it } from "vitest";

import { assertOwner, assertToolAllowed, assertValidTaskTransition } from "@/lib/permissions";

 describe("ownership and execution permissions", () => {
  it("rejects cross-user access", () => {
    expect(() => assertOwner("user-a", "user-b")).toThrow("access");
    expect(() => assertOwner("user-a", "user-a")).not.toThrow();
  });

  it("rejects tools outside the agent allowlist", () => {
    expect(() => assertToolAllowed({ allowed_tools: ["web_search"] }, "web_search")).not.toThrow();
    expect(() => assertToolAllowed({ allowed_tools: ["web_search"] }, "run_tests")).toThrow("not allowed");
  });

  it("enforces the task state machine", () => {
    expect(() => assertValidTaskTransition("queued", "running")).not.toThrow();
    expect(() => assertValidTaskTransition("running", "waiting_approval")).not.toThrow();
    expect(() => assertValidTaskTransition("waiting_approval", "queued")).not.toThrow();
    expect(() => assertValidTaskTransition("completed", "running")).toThrow("cannot move");
    expect(() => assertValidTaskTransition("queued", "completed")).toThrow("cannot move");
  });
});
