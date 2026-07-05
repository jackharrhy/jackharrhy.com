import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cancel, confirm, isCancel } from "@clack/prompts";

export const ROOT_DIR = path.resolve(import.meta.dirname, "../..");

export function loadEnv() {
  const envFile = path.join(ROOT_DIR, ".env");

  if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

export function run(
  command: string,
  args: string[],
  options: { capture?: boolean } = {},
) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (options.capture && result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout || "";
}

export function output(command: string, args: string[]) {
  return run(command, args, { capture: true }).trim();
}

export function usage(message: string): never {
  console.log(message.trimEnd());
  process.exit(1);
}

export async function confirmOrExit(
  message: string,
  options = { envVar: "YES" },
) {
  if (process.env[options.envVar] === "true") {
    console.log(`${options.envVar}=true set; skipping confirmation.`);
    return;
  }

  if (!process.stdin.isTTY) {
    const answer = fs.readFileSync(0, "utf8").trim();
    if (/^y(es)?$/i.test(answer)) return;
    console.log("Cancelled.");
    process.exit(1);
  }

  const shouldContinue = await confirm({ message });
  if (isCancel(shouldContinue) || !shouldContinue) {
    cancel("Cancelled.");
    process.exit(1);
  }
}

export function normalizeRelativePath(value: string) {
  return value.replaceAll(path.sep, "/");
}

export function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files.sort();
}
