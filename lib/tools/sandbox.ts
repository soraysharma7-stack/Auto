import "server-only";

import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rm } from "node:fs/promises";
import path from "node:path";

import { isSandboxEnabled } from "@/lib/env";
import { AppError } from "@/lib/errors";

const allowedTestCommands = new Set([
  "node --test",
  "npm test",
  "npm run lint",
  "npm run build",
  "npx tsc --noEmit",
]);

export function resolveSandboxPath(root: string, requested: string): string {
  if (!requested || requested.includes("\0") || path.posix.isAbsolute(requested) || path.win32.isAbsolute(requested)) {
    throw new AppError("A relative workspace file path is required", 422, "INVALID_PATH");
  }
  const normalized = path.posix.normalize(requested.replaceAll("\\", "/"));
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new AppError("Workspace paths cannot escape the sandbox", 403, "PATH_OUTSIDE_SANDBOX");
  }
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, normalized);
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) {
    throw new AppError("Workspace paths cannot escape the sandbox", 403, "PATH_OUTSIDE_SANDBOX");
  }
  return resolved;
}

export class CodingSandbox {
  readonly root: string;

  constructor(runId: string) {
    this.root = resolveSandboxPath(
      process.env.AUTO_SANDBOX_ROOT ?? "/tmp/auto-sandboxes",
      runId,
    );
  }

  private assertEnabled(): void {
    if (!isSandboxEnabled()) {
      throw new AppError("The isolated coding sandbox is not configured on the worker", 503, "SANDBOX_UNAVAILABLE");
    }
  }

  async initialize(): Promise<void> {
    this.assertEnabled();
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }

  private async safeTarget(requested: string): Promise<string> {
    const lexicalTarget = resolveSandboxPath(this.root, requested);
    const relative = path.relative(this.root, lexicalTarget);
    const rootReal = await realpath(this.root);
    let current = rootReal;
    const parent = path.dirname(relative);
    if (parent !== ".") {
      for (const segment of parent.split(path.sep)) {
        current = path.join(current, segment);
        try {
          const stat = await lstat(current);
          if (stat.isSymbolicLink() || !stat.isDirectory()) {
            throw new AppError("Workspace directory symlinks are not allowed", 403, "SYMLINK_REJECTED");
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          await mkdir(current, { mode: 0o700 });
        }
      }
    }
    const target = path.join(rootReal, relative);
    try {
      if ((await lstat(target)).isSymbolicLink()) {
        throw new AppError("Symbolic-link targets are not allowed", 403, "SYMLINK_REJECTED");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return target;
  }

  async read(requested: string): Promise<string> {
    this.assertEnabled();
    const target = await this.safeTarget(requested);
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const content = await handle.readFile("utf8");
      if (content.length > 200_000) throw new AppError("File is too large to read", 413, "FILE_TOO_LARGE");
      return content;
    } finally {
      await handle.close();
    }
  }

  async write(requested: string, content: string): Promise<void> {
    this.assertEnabled();
    if (content.length > 500_000) throw new AppError("File is too large to write", 413, "FILE_TOO_LARGE");
    const target = await this.safeTarget(requested);
    const handle = await open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
    try {
      await handle.writeFile(content, "utf8");
    } finally {
      await handle.close();
    }
  }

  async cleanup(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }
}

export function runDockerTests(
  workspace: string,
  command: string,
  signal?: AbortSignal,
): Promise<{ command: string; exitCode: number; output: string }> {
  if (!allowedTestCommands.has(command)) {
    throw new AppError("Choose an approved test command", 422, "COMMAND_NOT_ALLOWED");
  }
  const image = process.env.AUTO_SANDBOX_DOCKER_IMAGE ?? "node:22-alpine";
  const args = [
    "run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges", "--pids-limit", "128", "--memory", "512m",
    "--cpus", "1", "--user", "1000:1000", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec",
    "--volume", `${workspace}:/workspace:rw`, "--workdir", "/workspace",
    image, "sh", "-c", command,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const append = (chunk: Buffer) => {
      if (output.length < 100_000) output += chunk.toString("utf8");
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => finish(() => reject(
      (error as NodeJS.ErrnoException).code === "ENOENT"
        ? new AppError("Docker is not installed on the worker", 503, "SANDBOX_UNAVAILABLE")
        : error,
    )));
    child.on("close", (code) => finish(() => resolve({ command, exitCode: code ?? 1, output: output.slice(-100_000) })));
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new AppError("The sandbox test timed out", 408, "SANDBOX_TIMEOUT")));
    }, 60_000);
    const onAbort = () => {
      child.kill("SIGKILL");
      finish(() => reject(new AppError("The sandbox test was cancelled", 408, "SANDBOX_CANCELLED")));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
