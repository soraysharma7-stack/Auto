import { existsSync } from "node:fs";

/** Matches Next.js local-file precedence; explicitly supplied process variables always win. */
export function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
