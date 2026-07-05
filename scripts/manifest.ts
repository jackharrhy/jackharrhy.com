#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalRouteId } from "../lib/garden-routing.mjs";
import {
  loadEnv,
  normalizeRelativePath,
  ROOT_DIR,
  usage,
  walkFiles,
} from "./lib/cli.ts";

type ManifestPage = {
  route: string;
  sourcePath: string;
  title?: string;
  description?: string;
  hash: string;
  bytes: number;
};

type ManifestAsset = {
  url: string;
  sourcePath: string;
  hash: string;
  bytes: number;
};

type DeployManifest = {
  generatedAt: string;
  pages: ManifestPage[];
  assets: ManifestAsset[];
};

loadEnv();

const GARDEN_DIR = path.resolve(
  ROOT_DIR,
  process.env.GARDEN_VAULT_PATH || "./vault/Garden",
);
const ASSETS_DIR = path.resolve(
  ROOT_DIR,
  process.env.GARDEN_VAULT_ASSETS_PATH || "./vault/Assets",
);
const STATE_DIR = path.join(ROOT_DIR, ".garden");
const LOCAL_MANIFEST_PATH = path.join(STATE_DIR, "deploy-manifest.json");
const PUBLIC_MANIFEST_PATH = path.join(
  ROOT_DIR,
  "public",
  "deploy-manifest.json",
);

const assetExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".pdf",
  ".png",
  ".svg",
  ".wav",
  ".webm",
  ".webp",
]);

function printUsage(): never {
  usage(`Usage: node scripts/manifest.ts [write]

Writes a deploy manifest to:
  .garden/deploy-manifest.json
  public/deploy-manifest.json

Environment:
  GARDEN_VAULT_PATH         Vault Garden path, default ./vault/Garden
  GARDEN_VAULT_ASSETS_PATH  Vault assets path, default ./vault/Assets
`);
}

function sha256(buffer: Buffer | string) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
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

function buildManifest(): DeployManifest {
  const pages: ManifestPage[] = [];

  for (const filePath of walkFiles(GARDEN_DIR)) {
    if (!filePath.endsWith(".md")) continue;

    const markdown = fs.readFileSync(filePath, "utf8");
    const frontmatter = parseFrontmatter(markdown);

    if (frontmatter.get("public") !== "true") continue;

    const sourcePath = normalizeRelativePath(
      path.relative(GARDEN_DIR, filePath),
    );
    const routeId = canonicalRouteId(sourcePath);

    pages.push({
      route: routeId ? `/${routeId}` : "/",
      sourcePath,
      title: frontmatter.get("title"),
      description: frontmatter.get("description"),
      hash: sha256(markdown),
      bytes: Buffer.byteLength(markdown),
    });
  }

  const assets: ManifestAsset[] = [];

  for (const filePath of walkFiles(ASSETS_DIR)) {
    const ext = path.extname(filePath).toLowerCase();
    if (!assetExtensions.has(ext)) continue;

    const buffer = fs.readFileSync(filePath);
    const sourcePath = normalizeRelativePath(
      path.relative(ASSETS_DIR, filePath),
    );

    assets.push({
      url: `/asset/${sourcePath}`,
      sourcePath,
      hash: sha256(buffer),
      bytes: buffer.byteLength,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    pages: pages.sort((a, b) => a.route.localeCompare(b.route)),
    assets: assets.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)),
  };
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

const command = process.argv[2] ?? "write";
if (command === "--help" || command === "-h") printUsage();
if (command !== "write") printUsage();

const manifest = buildManifest();

writeJson(LOCAL_MANIFEST_PATH, manifest);
writeJson(PUBLIC_MANIFEST_PATH, manifest);

console.log("Deploy manifest written.");
console.log(`Public pages: ${manifest.pages.length}`);
console.log(`Assets: ${manifest.assets.length}`);
console.log(`Local: ${LOCAL_MANIFEST_PATH}`);
console.log(`Public: ${PUBLIC_MANIFEST_PATH}`);
