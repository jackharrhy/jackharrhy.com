#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT_DIR, ".env");

if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function output(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

const image = process.env.DEPLOY_IMAGE || "ghcr.io/jackharrhy/jackharrhy.com";
const tag =
  process.env.DEPLOY_TAG || output("git", ["rev-parse", "--short", "HEAD"]);
const tags = [`${image}:${tag}`];

if (process.env.DEPLOY_LATEST !== "false") {
  tags.push(`${image}:latest`);
}

console.log(`Deploy image: ${tags.join(", ")}`);

run("pnpm", ["format:check"]);
run("npm", ["run", "build"]);
run("node", ["scripts/assets.ts", "copy-to-r2"]);
run("node", ["scripts/assets.ts", "check"]);

const buildArgs = ["build", "--target", "prebuilt-runtime"];
for (const imageTag of tags) {
  buildArgs.push("--tag", imageTag);
}
buildArgs.push(".");

run("docker", buildArgs);

for (const imageTag of tags) {
  run("docker", ["push", imageTag]);
}
