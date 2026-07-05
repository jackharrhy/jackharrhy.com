#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Options = {
  dryRun: boolean;
  yes: boolean;
};

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

const ENV_FILE = path.join(ROOT_DIR, ".env");
if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const ASSETS_DIR = path.resolve(
  ROOT_DIR,
  process.env.GARDEN_VAULT_ASSETS_PATH || "./vault/Assets",
);
const RCLONE_REMOTE = process.env.GARDEN_RCLONE_REMOTE || "garden:jacks-garden";

function usage(): never {
  console.log(`Usage: node scripts/assets.ts <command> [options]

Commands:
  diff                 Compare local vault assets and the R2 bucket
  missing-local        List files present in R2 but missing locally
  missing-remote       List files present locally but missing in R2
  pull-missing         Copy files present in R2 but missing locally into vault assets
  copy-to-r2           Copy new/changed local vault assets to R2 without deleting remote files
  sync-to-r2           Sync local vault assets to R2; requires --yes unless --dry-run is used

Options:
  --dry-run            Show what rclone would do without copying or deleting
  --yes                Confirm destructive sync-to-r2

Environment:
  GARDEN_VAULT_ASSETS_PATH   Local assets directory, default ./vault/Assets
  GARDEN_RCLONE_REMOTE       R2 rclone remote, default garden:jacks-garden
`);
  process.exit(1);
}

function parseArgs(argv: string[]): { command: string; options: Options } {
  const [command, ...flags] = argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    usage();
  }

  return {
    command,
    options: {
      dryRun: flags.includes("--dry-run"),
      yes: flags.includes("--yes"),
    },
  };
}

function run(
  command: string,
  args: string[],
  options: { capture?: boolean } = {},
) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
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

function rclone(args: string[], options: { capture?: boolean } = {}) {
  return run("rclone", args, options);
}

function normalizeRelativePath(value: string) {
  return value.replaceAll(path.sep, "/");
}

function collectLocalFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectLocalFiles(fullPath, base));
      continue;
    }

    if (entry.isFile()) {
      files.push(normalizeRelativePath(path.relative(base, fullPath)));
    }
  }

  return files.sort();
}

function collectRemoteFiles() {
  return rclone(["lsf", RCLONE_REMOTE, "--files-only", "--recursive"], {
    capture: true,
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function difference(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function printList(title: string, files: string[]) {
  console.log(`${title}: ${files.length}`);

  for (const file of files) {
    console.log(file);
  }
}

function writeFilesFrom(files: string[]) {
  const filePath = path.join(os.tmpdir(), `garden-assets-${process.pid}.txt`);
  fs.writeFileSync(filePath, `${files.join("\n")}\n`);
  return filePath;
}

function withFilesFrom(files: string[], callback: (filePath: string) => void) {
  if (files.length === 0) {
    console.log("Nothing to copy.");
    return;
  }

  const filePath = writeFilesFrom(files);

  try {
    callback(filePath);
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

function getDiff() {
  const local = collectLocalFiles(ASSETS_DIR);
  const remote = collectRemoteFiles();

  return {
    local,
    remote,
    missingLocal: difference(remote, local),
    missingRemote: difference(local, remote),
  };
}

function copyWithFilesFrom(
  source: string,
  dest: string,
  files: string[],
  options: Options,
) {
  withFilesFrom(files, (filesFrom) => {
    const args = [
      "copy",
      source,
      dest,
      "--files-from",
      filesFrom,
      "--progress",
    ];

    if (options.dryRun) {
      args.push("--dry-run");
    }

    rclone(args);
  });
}

const { command, options } = parseArgs(process.argv);

switch (command) {
  case "diff": {
    const { local, remote, missingLocal, missingRemote } = getDiff();
    console.log(`Local assets: ${ASSETS_DIR}`);
    console.log(`R2 remote: ${RCLONE_REMOTE}`);
    console.log(`Local files: ${local.length}`);
    console.log(`Remote files: ${remote.length}`);
    console.log(`Missing locally: ${missingLocal.length}`);
    console.log(`Missing remotely: ${missingRemote.length}`);
    break;
  }

  case "missing-local": {
    printList("Missing locally", getDiff().missingLocal);
    break;
  }

  case "missing-remote": {
    printList("Missing remotely", getDiff().missingRemote);
    break;
  }

  case "pull-missing": {
    const { missingLocal } = getDiff();
    console.log(
      `Copying ${missingLocal.length} missing local files from ${RCLONE_REMOTE} to ${ASSETS_DIR}`,
    );
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    copyWithFilesFrom(RCLONE_REMOTE, ASSETS_DIR, missingLocal, options);
    break;
  }

  case "copy-to-r2": {
    console.log(`Copying local assets from ${ASSETS_DIR} to ${RCLONE_REMOTE}`);
    rclone([
      "copy",
      ASSETS_DIR,
      RCLONE_REMOTE,
      "--progress",
      ...(options.dryRun ? ["--dry-run"] : []),
    ]);
    break;
  }

  case "sync-to-r2": {
    if (!options.dryRun && !options.yes) {
      console.error(
        "sync-to-r2 can delete remote files. Re-run with --dry-run or --yes.",
      );
      process.exit(1);
    }

    console.log(`Syncing local assets from ${ASSETS_DIR} to ${RCLONE_REMOTE}`);
    rclone([
      "sync",
      ASSETS_DIR,
      RCLONE_REMOTE,
      "--progress",
      ...(options.dryRun ? ["--dry-run"] : []),
    ]);
    break;
  }

  default:
    usage();
}
