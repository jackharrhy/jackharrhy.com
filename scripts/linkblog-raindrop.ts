#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  getLinkblogRaindropConfig,
  getLinkblogRaindropStatus,
  syncDoneLinkblogRaindrops,
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
  sync-done    Move Raindrops with public day pages to imported collection

Environment:
  GARDEN_RAINDROP_TOKEN       Raindrop.io API token
  GARDEN_RAINDROP_COLLECTION  Collection title, default "Logseq To Import"
  GARDEN_RAINDROP_IMPORTED_COLLECTION Imported collection title, default "Logseq Imported"
  GARDEN_VAULT_PATH           Vault Garden path, default ./vault/Garden
`);
  process.exit(1);
}

const command = process.argv[2];
if (!command || command === "--help" || command === "-h") usage();
const apply = process.argv.includes("--apply");

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

  case "sync-done": {
    const result = await syncDoneLinkblogRaindrops({ ...config, apply });
    console.log(`Collection: ${result.collectionTitle}`);
    console.log(`Imported collection: ${result.importedCollectionTitle}`);

    if (result.importedCollectionCreated) {
      console.log("Created imported collection");
    }

    if (result.apply) {
      console.log(`Moved: ${result.moved.length}`);
      for (const item of result.moved) {
        console.log(`- ${item.date} ${item.title}`);
        console.log(`  ${item.link}`);
      }
    } else {
      console.log(`Ready to move: ${result.ready.length}`);
      console.log("Run with --apply to move these Raindrops.");
      for (const item of result.ready) {
        console.log(`- ${item.date} ${item.title}`);
        console.log(`  ${item.link}`);
      }
    }

    console.log(`Remaining todo: ${result.remaining.length}`);
    break;
  }

  default:
    usage();
}
