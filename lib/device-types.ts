import type { Device } from "@/lib/types";

export type DevicePermission = {
  id: string;
  device_id: string;
  user_id: string;
  capability: "screen" | "input" | "files";
  enabled: boolean;
  paths: string[];
  updated_at: string;
};

export type DeviceSession = {
  id: string;
  device_id: string;
  user_id: string;
  status: "active" | "stopped" | "revoked" | "expired";
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
};

export type DeviceAction = {
  id: string;
  session_id: string;
  device_id: string;
  user_id: string;
  type: "screen_snapshot" | "mouse_move" | "mouse_click" | "type_text" | "read_file" | "write_file";
  payload: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  result: Record<string, unknown> | null;
  error: string | null;
  expires_at: string;
  created_at: string;
};

export type DeviceBundle = {
  devices: Device[];
  permissions: DevicePermission[];
  sessions: DeviceSession[];
  actions: DeviceAction[];
};
