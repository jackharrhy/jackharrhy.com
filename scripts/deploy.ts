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

const gardenDir = path.resolve(
  ROOT_DIR,
  process.env.GARDEN_VAULT_PATH || "./vault/Garden",
);
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

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return new Map<string, string>();

  const values = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    const scalar = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!scalar) continue;
    values.set(scalar[1], scalar[2].trim().replace(/^['"]|['"]$/g, ""));
  }

  return values;
}

function walkMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(filePath));
    } else if (entry.isFile() && filePath.endsWith(".md")) {
      files.push(filePath);
    }
  }

  return files.sort();
}

function validatePublicLinkblogEntries() {
  const linkblogDir = path.join(gardenDir, "Linkblog");
  const failures: string[] = [];

  for (const filePath of walkMarkdownFiles(linkblogDir)) {
    const frontmatter = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
    if (frontmatter.get("public") !== "true") continue;

    const missing = [];
    if (!frontmatter.get("description")) missing.push("description");
    if (!frontmatter.get("og-image")) missing.push("og-image");

    if (missing.length > 0) {
      failures.push(
        `${path.relative(ROOT_DIR, filePath)} missing ${missing.join(", ")}`,
      );
    }
  }

  if (failures.length === 0) return;

  console.error("");
  console.error("Deploy blocked: public Linkblog entries need metadata.");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error("");
  console.error(
    "Set public: false for drafts, or add non-empty description and og-image frontmatter.",
  );
  process.exit(1);
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
run("npm", ["run", "check"]);
validatePublicLinkblogEntries();
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
