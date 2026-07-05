#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { confirmOrExit, loadEnv, output, ROOT_DIR, run } from "./lib/cli.ts";

type ManifestItem = {
  route?: string;
  sourcePath: string;
  hash: string;
  bytes: number;
};

type DeployManifest = {
  generatedAt: string;
  pages: ManifestItem[];
  assets: ManifestItem[];
};

loadEnv();

const image = process.env.DEPLOY_IMAGE || "ghcr.io/jackharrhy/jackharrhy.com";
const tag =
  process.env.DEPLOY_TAG || output("git", ["rev-parse", "--short", "HEAD"]);
const platform = process.env.DEPLOY_PLATFORM || "linux/amd64";
const manifestUrl =
  process.env.DEPLOY_MANIFEST_URL ||
  "https://jackharrhy.com/deploy-manifest.json";
const manifestPath = path.join(ROOT_DIR, "public", "deploy-manifest.json");
const tags = [`${image}:${tag}`];

if (process.env.DEPLOY_LATEST !== "false") {
  tags.push(`${image}:latest`);
}

console.log(`Deploy image: ${tags.join(", ")}`);
console.log(`Deploy platform: ${platform}`);

function readLocalManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as DeployManifest;
}

async function fetchProdManifest() {
  const response = await fetch(manifestUrl, { cache: "no-store" });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch prod manifest: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as DeployManifest;
}

function diffItems(
  prodItems: ManifestItem[],
  localItems: ManifestItem[],
  keyFor: (item: ManifestItem) => string,
) {
  const prodByKey = new Map(prodItems.map((item) => [keyFor(item), item]));
  const localByKey = new Map(localItems.map((item) => [keyFor(item), item]));
  const added: ManifestItem[] = [];
  const removed: ManifestItem[] = [];
  const changed: ManifestItem[] = [];

  for (const item of localItems) {
    const prodItem = prodByKey.get(keyFor(item));

    if (!prodItem) {
      added.push(item);
      continue;
    }

    if (prodItem.hash !== item.hash) {
      changed.push(item);
    }
  }

  for (const item of prodItems) {
    if (!localByKey.has(keyFor(item))) {
      removed.push(item);
    }
  }

  return { added, removed, changed };
}

function printList<T>(items: T[], format: (item: T) => string, limit = 25) {
  if (items.length === 0) {
    console.log("  none");
    return;
  }

  for (const item of items.slice(0, limit)) {
    console.log(`  - ${format(item)}`);
  }

  if (items.length > limit) {
    console.log(`  ... ${items.length - limit} more`);
  }
}

async function confirmDeploy(
  local: DeployManifest,
  prod: DeployManifest | null,
) {
  console.log("");
  console.log("Deploy manifest preview");
  console.log(`Local manifest: ${manifestPath}`);
  console.log(`Prod manifest: ${manifestUrl}`);
  console.log(`Local generated: ${local.generatedAt}`);

  if (!prod) {
    console.log("Prod manifest: not found; treating this as a first deploy.");
  } else {
    console.log(`Prod generated: ${prod.generatedAt}`);
  }

  const pageDiff = diffItems(prod?.pages ?? [], local.pages, (item) => {
    if (!item.route) throw new Error("Page manifest item is missing route");
    return item.route;
  });
  const assetDiff = diffItems(
    prod?.assets ?? [],
    local.assets,
    (item) => item.sourcePath,
  );

  console.log("");
  console.log(`Pages: ${local.pages.length}`);
  console.log(`  added: ${pageDiff.added.length}`);
  printList(pageDiff.added, (item) => `${item.route} (${item.sourcePath})`);
  console.log(`  changed: ${pageDiff.changed.length}`);
  printList(pageDiff.changed, (item) => `${item.route} (${item.sourcePath})`);
  console.log(`  removed: ${pageDiff.removed.length}`);
  printList(pageDiff.removed, (item) => `${item.route} (${item.sourcePath})`);

  console.log("");
  console.log(`Assets: ${local.assets.length}`);
  console.log(`  added: ${assetDiff.added.length}`);
  printList(
    assetDiff.added,
    (item) => `${item.sourcePath} (${item.bytes} bytes)`,
  );
  console.log(`  changed: ${assetDiff.changed.length}`);
  printList(
    assetDiff.changed,
    (item) => `${item.sourcePath} (${item.bytes} bytes)`,
  );
  console.log(`  removed: ${assetDiff.removed.length}`);
  printList(assetDiff.removed, (item) => item.sourcePath);

  console.log("");
  await confirmOrExit("Continue deploy?", { envVar: "DEPLOY_YES" });
}

run("pnpm", ["format:check"]);
run("npm", ["run", "deploy:manifest"]);
await confirmDeploy(readLocalManifest(), await fetchProdManifest());
run("npm", ["run", "build"]);
run("node", ["scripts/assets.ts", "copy-to-r2"]);
run("node", ["scripts/assets.ts", "check"]);

const buildArgs = [
  "buildx",
  "build",
  "--platform",
  platform,
  "--target",
  "prebuilt-runtime",
  "--push",
];
for (const imageTag of tags) {
  buildArgs.push("--tag", imageTag);
}
buildArgs.push(".");

run("docker", buildArgs);
