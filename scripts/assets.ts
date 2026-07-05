#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "@bomb.sh/args";
import {
  loadEnv,
  normalizeRelativePath,
  ROOT_DIR,
  run,
  usage,
  walkFiles,
} from "./lib/cli.ts";

type Options = {
  dryRun: boolean;
  yes: boolean;
};

loadEnv();

const ASSETS_DIR = path.resolve(
  ROOT_DIR,
  process.env.GARDEN_VAULT_ASSETS_PATH || "./vault/Assets",
);
const RCLONE_REMOTE =
  process.env.GARDEN_RCLONE_REMOTE || "jacks-garden:jacks-garden";

function isRemoteRoot(remote: string) {
  return /^[^:]+:\/?$/.test(remote.trim());
}

function assertSafeRemote(remote: string) {
  if (isRemoteRoot(remote)) {
    console.error(
      `Refusing to operate on remote root "${remote}". Set GARDEN_RCLONE_REMOTE to a bucket/subpath, for example "jacks-garden:jacks-garden".`,
    );
    process.exit(1);
  }
}

function printUsage(): never {
  usage(`Usage: node scripts/assets.ts <command> [options]

Commands:
  diff                 Compare local vault assets and the R2 bucket
  check                Verify local vault assets and the R2 bucket contain the same files
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
  GARDEN_RCLONE_REMOTE       R2 rclone bucket/subpath, default jacks-garden:jacks-garden
`);
}

function parseArgs(argv: string[]): { command: string; options: Options } {
  const args = parse(argv.slice(2), {
    boolean: ["dry-run", "yes", "help"],
    alias: { h: "help" },
  });
  const command = args._[0]?.toString();

  if (!command || args.help) {
    printUsage();
  }

  return {
    command,
    options: {
      dryRun: args["dry-run"],
      yes: args.yes,
    },
  };
}

function rclone(args: string[], options: { capture?: boolean } = {}) {
  return run("rclone", args, options);
}

function collectLocalFiles(dir: string, base = dir): string[] {
  return walkFiles(dir)
    .map((filePath) => normalizeRelativePath(path.relative(base, filePath)))
    .sort();
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

assertSafeRemote(RCLONE_REMOTE);

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

  case "check": {
    const { local, remote, missingLocal, missingRemote } = getDiff();
    console.log(`Local assets: ${ASSETS_DIR}`);
    console.log(`R2 remote: ${RCLONE_REMOTE}`);
    console.log(`Local files: ${local.length}`);
    console.log(`Remote files: ${remote.length}`);
    console.log(`Missing locally: ${missingLocal.length}`);
    console.log(`Missing remotely: ${missingRemote.length}`);

    if (missingLocal.length > 0 || missingRemote.length > 0) {
      console.error(
        "Asset check failed. Run assets:pull:missing or assets:copy:to-r2, then check again.",
      );
      process.exit(1);
    }

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
    printUsage();
}
