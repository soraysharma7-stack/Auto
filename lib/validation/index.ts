import { z } from "zod";

export const idSchema = z.uuid();
export const aiModeSchema = z.enum(["auto", "deep", "coding", "max", "student"]);
export const providerSchema = z.enum(["gemini", "openai", "anthropic", "tavily"]);
export const toolNameSchema = z.enum([
  "web_search",
  "read_file",
  "write_file",
  "run_tests",
  "device_action",
]);

export const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(128),
});

export const agentInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  role: z.string().trim().min(2).max(80),
  instructions: z.string().trim().min(10).max(12_000),
  preferredProvider: providerSchema.exclude(["tavily"]).nullable().default(null),
  preferredModel: z.string().trim().max(160).nullable().default(null),
  allowedTools: z.array(toolNameSchema).max(5).default([]),
  requiresApproval: z.boolean().default(true),
  maxOutputTokens: z.number().int().min(128).max(16_384).default(2048),
});

export const chatInputSchema = z.object({
  conversationId: z.uuid().nullable().default(null),
  message: z.string().trim().min(1).max(24_000),
  mode: aiModeSchema.default("auto"),
});

export const taskInputSchema = z.object({
  agentId: z.uuid(),
  description: z.string().trim().min(3).max(24_000),
  mode: aiModeSchema.default("auto"),
});

export const connectionInputSchema = z.object({
  provider: providerSchema,
  model: z.string().trim().max(160).default(""),
  apiKey: z.string().trim().min(8).max(512),
  priority: z.number().int().min(1).max(100).default(50),
  supportedModes: z.array(aiModeSchema).min(1).max(5).default(["auto", "deep", "coding", "max", "student"]),
  contextLimitTokens: z.number().int().min(4096).max(2_000_000).default(128_000),
});

export const pairingInputSchema = z.object({
  code: z.string().trim().length(8),
  deviceName: z.string().trim().min(2).max(80),
  appVersion: z.string().trim().min(1).max(40),
});

const deviceActionBase = { sessionId: z.uuid() };
export const deviceActionSchema = z.discriminatedUnion("type", [
  z.object({ ...deviceActionBase, type: z.literal("screen_snapshot"), payload: z.object({}).strict().default({}) }),
  z.object({ ...deviceActionBase, type: z.literal("mouse_move"), payload: z.object({ x: z.number().int().min(0).max(100_000), y: z.number().int().min(0).max(100_000) }).strict() }),
  z.object({ ...deviceActionBase, type: z.literal("mouse_click"), payload: z.object({ button: z.enum(["left", "right", "middle"]).default("left") }).strict().default({ button: "left" }) }),
  z.object({ ...deviceActionBase, type: z.literal("type_text"), payload: z.object({ text: z.string().min(1).max(5000) }).strict() }),
  z.object({ ...deviceActionBase, type: z.literal("read_file"), payload: z.object({ path: z.string().min(1).max(4096) }).strict() }),
  z.object({ ...deviceActionBase, type: z.literal("write_file"), payload: z.object({ path: z.string().min(1).max(4096), content: z.string().max(500_000) }).strict() }),
]);

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});
