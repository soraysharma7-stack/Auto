import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import path from "node:path";

import { AppError } from "@/lib/errors";
import { deviceActionSchema } from "@/lib/validation";

export function isPathWithin(target: string, base: string): boolean {
  const windows = /^[a-z]:\//i.test(base.replaceAll("\\", "/"));
  const resolve = (value: string) => {
    const normalized = windows
      ? path.win32.resolve(value).replaceAll("\\", "/").toLowerCase()
      : path.posix.resolve(value);
    return normalized.replace(/\/$/, "");
  };
  const resolvedTarget = resolve(target);
  const resolvedBase = resolve(base);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}/`);
}

export async function queueDeviceAction(
  supabase: SupabaseClient,
  userId: string,
  rawInput: unknown,
  expectedDeviceId?: string,
) {
  const input = deviceActionSchema.parse(rawInput);
  const { data: session } = await supabase.from("device_sessions").select("id, device_id, devices!inner(status)")
    .eq("id", input.sessionId).eq("user_id", userId).eq("status", "active").maybeSingle();
  const device = session?.devices as { status: string } | undefined;
  if (!session || device?.status !== "active") {
    throw new AppError("The device session is not active", 409, "DEVICE_SESSION_UNAVAILABLE");
  }
  if (expectedDeviceId && session.device_id !== expectedDeviceId) {
    throw new AppError("The session belongs to a different device", 403, "DEVICE_MISMATCH");
  }
  const capability = input.type === "screen_snapshot" ? "screen" : input.type.includes("file") ? "files" : "input";
  const { data: permission } = await supabase.from("device_permissions").select("enabled, paths")
    .eq("device_id", session.device_id).eq("user_id", userId).eq("capability", capability).eq("enabled", true).maybeSingle();
  if (!permission) throw new AppError(`The device has not granted ${capability} permission`, 403, "DEVICE_PERMISSION_DENIED");

  if (input.type === "read_file" || input.type === "write_file") {
    const requestedPath = input.payload.path;
    if (typeof requestedPath !== "string" || !permission.paths.some((base: string) => isPathWithin(requestedPath, base))) {
      throw new AppError("The requested file is outside the user-granted folders", 403, "DEVICE_PATH_DENIED");
    }
  }
  const { data: action, error } = await supabase.from("device_actions").insert({
    session_id: session.id,
    device_id: session.device_id,
    user_id: userId,
    type: input.type,
    payload: input.payload,
  }).select("*").single();
  if (error) throw new AppError(error.message, 500, "DATABASE_ERROR");
  return action;
}
