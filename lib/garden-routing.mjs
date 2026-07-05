import fs from "node:fs";
import path from "node:path";

const markdownExtensions = new Set([".md", ".mdx"]);
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

export function slugifySegment(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function canonicalRouteId(vaultRelativePath) {
  return stripExtension(normalizeVaultPath(vaultRelativePath))
    .split("/")
    .map(slugifySegment)
    .filter(Boolean)
    .join("/");
}

export function buildGardenIndex(entries, options = {}) {
  const assetUrlPrefix = trimSlashes(options.assetUrlPrefix ?? "asset");
  const index = {
    entries: [],
    lookup: new Map(),
    routeIds: new Map(),
    collisions: [],
  };

  for (const input of entries) {
    const sourcePath = normalizeVaultPath(input.path);
    const ext = extensionOf(sourcePath).toLowerCase();
    const kind = input.kind ?? (markdownExtensions.has(ext) ? "note" : "asset");
    const stemPath = stripExtension(sourcePath);
    const routeId =
      kind === "note"
        ? canonicalRouteId(sourcePath)
        : `${canonicalRouteId(stemPath)}${ext}`;

    const entry = {
      sourcePath,
      stemPath,
      basename: basename(stemPath),
      routeId,
      url: kind === "note" ? `/${routeId}` : `/${assetUrlPrefix}/${sourcePath}`,
      kind,
      aliases: input.aliases ?? [],
    };

    index.entries.push(entry);
    addLookup(index.lookup, sourcePath, entry);
    addLookup(index.lookup, stemPath, entry);
    addLookup(index.lookup, entry.basename, entry);
    addLookup(index.lookup, routeId, entry);

    for (const alias of entry.aliases) {
      addLookup(index.lookup, alias, entry);
    }

    const existingRoute = index.routeIds.get(routeId);
    if (existingRoute && existingRoute.sourcePath !== sourcePath) {
      index.collisions.push({
        key: routeId,
        entries: [existingRoute, entry],
        type: "route",
      });
    } else {
      index.routeIds.set(routeId, entry);
    }
  }

  for (const [key, matches] of index.lookup.entries()) {
    const unique = uniqueEntries(matches);
    if (unique.length > 1) {
      index.collisions.push({ key, entries: unique, type: "lookup" });
    }
  }

  return index;
}

export function buildGardenIndexFromVault(vaultPath, options = {}) {
  const root = path.resolve(vaultPath);
  const entries = [];

  for (const filePath of walkFiles(root)) {
    const ext = extensionOf(filePath).toLowerCase();
    if (!markdownExtensions.has(ext) && !assetExtensions.has(ext)) continue;

    const relativePath = normalizeVaultPath(path.relative(root, filePath));
    entries.push({
      path: relativePath,
      kind: markdownExtensions.has(ext) ? "note" : "asset",
      aliases: markdownExtensions.has(ext) ? readAliases(filePath) : [],
    });
  }

  return buildGardenIndex(entries, options);
}

export function parseWikiLink(raw) {
  const trimmed = raw.trim();
  const embed = trimmed.startsWith("!");
  const body = trimmed
    .replace(/^!/, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "");
  const [targetAndAnchor, label] = splitOnce(body, "|");
  const [targetText, anchor] = splitOnce(targetAndAnchor, "#");

  return {
    targetText: stripGardenPrefix(targetText.trim()),
    label: label?.trim() || undefined,
    anchor: anchor?.trim() || undefined,
    embed,
  };
}

export function resolveWikiLink(raw, index) {
  const parsed = parseWikiLink(raw);
  const matches = uniqueEntries(
    index.lookup.get(normalizeLookupKey(parsed.targetText)) ?? [],
  );
  const candidates = parsed.embed
    ? matches
    : matches.filter((entry) => entry.kind === "note");

  if (candidates.length === 0) {
    return { ok: false, raw, ...parsed, reason: "not-found" };
  }

  if (candidates.length > 1) {
    return { ok: false, raw, ...parsed, reason: "ambiguous", candidates };
  }

  const target = candidates[0];
  const anchor = parsed.anchor ? slugifySegment(parsed.anchor) : undefined;

  return {
    ok: true,
    raw,
    ...parsed,
    target,
    url: anchor ? `${target.url}#${anchor}` : target.url,
    media: target.kind === "asset",
  };
}

function addLookup(lookup, rawKey, entry) {
  const key = normalizeLookupKey(rawKey);
  if (!key) return;
  const matches = lookup.get(key) ?? [];
  matches.push(entry);
  lookup.set(key, matches);
}

function normalizeLookupKey(value) {
  return stripExtension(
    stripGardenPrefix(normalizeVaultPath(value)),
  ).toLowerCase();
}

function stripGardenPrefix(value) {
  const normalized = normalizeVaultPath(value);
  return normalized.startsWith("Garden/")
    ? normalized.slice("Garden/".length)
    : normalized;
}

function normalizeVaultPath(value) {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
}

function stripExtension(value) {
  const ext = extensionOf(value);
  return ext ? value.slice(0, -ext.length) : value;
}

function extensionOf(value) {
  const name = basename(value);
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index) : "";
}

function basename(value) {
  return value.split("/").at(-1) ?? value;
}

function splitOnce(value, separator) {
  const index = value.indexOf(separator);
  return index === -1
    ? [value]
    : [value.slice(0, index), value.slice(index + separator.length)];
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function uniqueEntries(entries) {
  return [
    ...new Map(entries.map((entry) => [entry.sourcePath, entry])).values(),
  ];
}

function* walkFiles(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walkFiles(filePath);
    else if (entry.isFile()) yield filePath;
  }
}

function readAliases(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return [];

  const aliases = [];
  const lines = frontmatter[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inline = line.match(/^aliases:\s*\[(.*)\]\s*$/);
    if (inline) {
      aliases.push(
        ...inline[1]
          .split(",")
          .map((alias) => alias.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean),
      );
      continue;
    }

    if (/^aliases:\s*$/.test(line)) {
      for (let j = i + 1; j < lines.length; j++) {
        const item = lines[j].match(/^\s*-\s*(.+?)\s*$/);
        if (!item) break;
        aliases.push(item[1].replace(/^['"]|['"]$/g, ""));
      }
    }
  }

  return aliases;
}
