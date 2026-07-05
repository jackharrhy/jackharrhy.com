#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  getLinkblogRaindropConfig,
  getLinkblogRaindropStatus,
  writeLinkblogRaindropDrafts,
} from "../src/lib/linkblog-raindrop.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT_DIR, ".env");

if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

function usage(): never {
  console.log(`Usage: node scripts/linkblog-raindrop.ts <command>

Commands:
  status       Show completed/todo Raindrop linkblog items
  write-drafts Create or update private vault draft pages for todo items

Environment:
  GARDEN_RAINDROP_TOKEN       Raindrop.io API token
  GARDEN_RAINDROP_COLLECTION  Collection title, default "Logseq To Import"
  GARDEN_VAULT_PATH           Vault Garden path, default ./vault/Garden
`);
  process.exit(1);
}

const command = process.argv[2];
if (!command || command === "--help" || command === "-h") usage();

const config = getLinkblogRaindropConfig();

switch (command) {
  case "status": {
    const status = await getLinkblogRaindropStatus(config);
    console.log(`Collection: ${status.collectionTitle}`);
    console.log(`Raindrops: ${status.total}`);
    console.log(`Completed: ${status.completed.length}`);
    console.log(`Todo: ${status.todo.length}`);

    for (const [date, items] of Object.entries(status.todoByDate)) {
      console.log(`\n${date} (${items.length})`);
      for (const item of items) {
        console.log(`- ${item.title}`);
        console.log(`  ${item.link}`);
      }
    }
    break;
  }

  case "write-drafts": {
    const result = await writeLinkblogRaindropDrafts(config);
    console.log(`Collection: ${result.status.collectionTitle}`);
    console.log(`Raindrops: ${result.status.total}`);
    console.log(`Completed: ${result.status.completed.length}`);
    console.log(`Todo: ${result.status.todo.length}`);
    console.log(`Written draft pages: ${result.written.length}`);

    for (const file of result.written) {
      console.log(`- ${file}`);
    }

    if (result.skippedPublic.length > 0) {
      console.log(`Skipped public pages: ${result.skippedPublic.length}`);
      for (const file of result.skippedPublic) {
        console.log(`- ${file}`);
      }
    }
    break;
  }

  default:
    usage();
}
