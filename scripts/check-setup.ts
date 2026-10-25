import { loadLocalEnv } from "./load-env";

async function main() {
  loadLocalEnv();
  const { isSupabaseConfigured } = await import("../lib/env");
  const checks = [
    ["Supabase URL", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)],
    ["Supabase anon key", Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
    ["Supabase service-role key", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["Provider encryption key", Boolean(process.env.PROVIDER_ENCRYPTION_KEY)],
    ["Worker secret", Boolean(process.env.WORKER_SECRET && process.env.WORKER_SECRET.length >= 32)],
  ] as const;

  for (const [name, configured] of checks) {
    console.log(`${configured ? "✓" : "○"} ${name}: ${configured ? "configured" : "not configured"}`);
  }
  console.log(`\nApplication data: ${isSupabaseConfigured() ? "ready to verify" : "setup required"}`);
  console.log("This check reports presence only; it does not claim credentials are valid.");
}

main().catch((error) => {
  console.error("Setup check failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
