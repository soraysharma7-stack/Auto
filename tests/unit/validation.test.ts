import { describe, expect, it } from "vitest";

import { agentInputSchema, chatInputSchema, deviceActionSchema, pairingInputSchema } from "@/lib/validation";

describe("input contracts", () => {
  it("applies conservative agent defaults", () => {
    const result = agentInputSchema.parse({ name: "Researcher", role: "Research", instructions: "Find accurate answers" });
    expect(result.requiresApproval).toBe(true);
    expect(result.allowedTools).toEqual([]);
    expect(result.maxOutputTokens).toBe(2048);
  });

  it("limits chat modes and message lengths", () => {
    expect(chatInputSchema.parse({ message: "Hello", conversationId: null }).mode).toBe("auto");
    expect(chatInputSchema.safeParse({ message: "", conversationId: null }).success).toBe(false);
    expect(chatInputSchema.safeParse({ message: "Hello", conversationId: null, mode: "unrestricted" }).success).toBe(false);
  });

  it("validates each device action payload instead of accepting arbitrary fields", () => {
    const sessionId = "10000000-0000-4000-8000-000000000001";
    expect(deviceActionSchema.safeParse({ sessionId, type: "mouse_move", payload: { x: -1, y: 20 } }).success).toBe(false);
    expect(deviceActionSchema.safeParse({ sessionId, type: "mouse_move", payload: { x: 10, y: 20, elevated: true } }).success).toBe(false);
    expect(deviceActionSchema.parse({ sessionId, type: "mouse_click", payload: {} }).payload).toEqual({ button: "left" });
    expect(deviceActionSchema.safeParse({ sessionId, type: "write_file", payload: { path: "C:\\\\Safe\\\\a.txt" } }).success).toBe(false);
  });

  it("requires an eight-character pairing code", () => {
    expect(pairingInputSchema.safeParse({ code: "ABC123", deviceName: "My PC", appVersion: "0.1.0" }).success).toBe(false);
    expect(pairingInputSchema.safeParse({ code: "ABCD2345", deviceName: "My PC", appVersion: "0.1.0" }).success).toBe(true);
  });
});
