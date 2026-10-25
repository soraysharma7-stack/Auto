import "server-only";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase public configuration is missing");
  return { url, anonKey };
}

export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return key;
}

export function getProviderEncryptionKey(): Buffer {
  const value = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!value) throw new Error("PROVIDER_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("PROVIDER_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function getWorkerSecret(): string {
  const secret = process.env.WORKER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("WORKER_SECRET must contain at least 32 characters");
  }
  return secret;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function isSandboxEnabled(): boolean {
  return process.env.AUTO_SANDBOX_ENABLED === "true";
}
