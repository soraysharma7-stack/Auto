import { loadLocalEnv } from "./load-env";

async function main() {
  loadLocalEnv();
  const [{ createSupabaseAdminClient }, { runNextTask }] = await Promise.all([
    import("../lib/supabase/admin"),
    import("../lib/tasks/worker"),
  ]);

  let stopping = false;
  const intervalMs = 2000;
  async function tick() {
    if (stopping) return;
    try {
      const supabase = createSupabaseAdminClient();
      await supabase.rpc("expire_stale_work");
      const processed = await runNextTask();
      if (processed) console.log(`[${new Date().toISOString()}] Completed one worker attempt`);
    } catch (error) {
      console.error("Worker tick failed", error instanceof Error ? error.message : error);
    } finally {
      if (!stopping) setTimeout(tick, intervalMs);
    }
  }

  function stop() {
    stopping = true;
    console.log("Worker stopping after the current attempt");
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log("Auto worker started. Press Ctrl+C to stop.");
  void tick();
}

main().catch((error) => {
  console.error("Worker could not start", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
