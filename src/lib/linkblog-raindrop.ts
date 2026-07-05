import fs from "node:fs";
import path from "node:path";

export type RaindropItem = {
  _id: number;
  title: string;
  link: string;
  excerpt?: string;
  created: string;
};

type RaindropCollection = {
  _id: number;
  title: string;
};

export type LinkblogRaindropOptions = {
  token?: string;
  collectionTitle?: string;
  importedCollectionTitle?: string;
  vaultPath?: string;
  cacheMs?: number;
  refresh?: boolean;
};

export type LinkblogRaindropSyncDoneOptions = LinkblogRaindropOptions & {
  apply?: boolean;
};

export type LinkblogRaindropSyncDoneItem = LinkblogRaindropStatusItem & {
  reason: "public-day-page";
};

export type LinkblogRaindropSyncDoneResult = {
  apply: boolean;
  collectionTitle: string;
  importedCollectionTitle: string;
  importedCollectionCreated: boolean;
  moved: LinkblogRaindropSyncDoneItem[];
  ready: LinkblogRaindropSyncDoneItem[];
  remaining: LinkblogRaindropStatusItem[];
};

export type LinkblogRaindropStatus = {
  collectionTitle: string;
  total: number;
  totalDays: number;
  completedDays: number;
  todoDays: number;
  completed: LinkblogRaindropStatusItem[];
  todo: LinkblogRaindropStatusItem[];
  todoByDate: Record<string, LinkblogRaindropStatusItem[]>;
};

type RaindropCache = {
  collectionTitle: string;
  fetchedAt: string;
  items: RaindropItem[];
};

export type LinkblogRaindropStatusItem = {
  id: number;
  title: string;
  link: string;
  normalizedLink: string;
  excerpt: string;
  created: string;
  date: string;
  existingPage?: string;
  draftPage: string;
};

const RAINDROP_API_BASE = "https://api.raindrop.io/rest/v1";
const DEFAULT_COLLECTION_TITLE = "Logseq To Import";
const DEFAULT_IMPORTED_COLLECTION_TITLE = "Logseq Imported";
const DEFAULT_CACHE_MS = 5 * 60 * 1000;
const CACHE_PATH = path.resolve(
  process.cwd(),
  ".garden/linkblog-raindrop-cache.json",
);

export function getLinkblogRaindropConfig(
  options: LinkblogRaindropOptions = {},
) {
  return {
    token: options.token ?? process.env.GARDEN_RAINDROP_TOKEN,
    collectionTitle:
      options.collectionTitle ??
      process.env.GARDEN_RAINDROP_COLLECTION ??
      DEFAULT_COLLECTION_TITLE,
    importedCollectionTitle:
      options.importedCollectionTitle ??
      process.env.GARDEN_RAINDROP_IMPORTED_COLLECTION ??
      DEFAULT_IMPORTED_COLLECTION_TITLE,
    vaultPath: path.resolve(
      options.vaultPath ?? process.env.GARDEN_VAULT_PATH ?? "./vault/Garden",
    ),
    cacheMs:
      options.cacheMs ??
      Number(process.env.GARDEN_RAINDROP_CACHE_MS ?? DEFAULT_CACHE_MS),
    refresh: options.refresh ?? false,
  };
}

function requireToken(token: string | undefined) {
  if (!token) {
    throw new Error("GARDEN_RAINDROP_TOKEN is not set");
  }

  return token;
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return value.trim();
  }
}

function markdownEscape(value: string) {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtu.be"
    );
  } catch {
    return false;
  }
}

function frontmatterPublic(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return false;
  return /^public:\s*true\s*$/m.test(match[1]);
}

function collectMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractMarkdownLinks(markdown: string) {
  const links = new Set<string>();
  const linkPattern = /(?<!!|\[)\[[^\]\n]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    links.add(normalizeUrl(match[1]));
  }

  return links;
}

function dateFromRaindrop(item: RaindropItem) {
  return new Date(item.created).toISOString().slice(0, 10);
}

function linkblogPathForDate(vaultPath: string, date: string) {
  const [year, month, day] = date.split("-");
  return path.join(vaultPath, "Linkblog", year, month, `${day}.md`);
}

function displayPath(vaultPath: string, filePath: string) {
  return path.relative(vaultPath, filePath).replaceAll(path.sep, "/");
}

async function raindropFetch<T>(
  token: string,
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${RAINDROP_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Raindrop request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

function clearRaindropCache() {
  fs.rmSync(CACHE_PATH, { force: true });
}

async function listRaindropCollections(token: string) {
  const collections = await raindropFetch<{ items: RaindropCollection[] }>(
    token,
    "/collections",
  );

  return collections.items;
}

async function getRaindropCollection(token: string, title: string) {
  const collections = await listRaindropCollections(token);
  return collections.find((item) => item.title === title);
}

async function createRaindropCollection(token: string, title: string) {
  const response = await raindropFetch<{
    item: RaindropCollection;
  }>(token, "/collection", {
    method: "POST",
    body: JSON.stringify({ title, view: "list", public: false }),
  });

  return response.item;
}

async function moveRaindropToCollection(
  token: string,
  itemId: number,
  collectionId: number,
) {
  await raindropFetch<{ result: boolean }>(token, `/raindrop/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ collection: { $id: collectionId } }),
  });
}

function readRaindropCache(collectionTitle: string, cacheMs: number) {
  if (cacheMs <= 0 || !fs.existsSync(CACHE_PATH)) return null;

  try {
    const cache = JSON.parse(
      fs.readFileSync(CACHE_PATH, "utf8"),
    ) as RaindropCache;
    const age = Date.now() - new Date(cache.fetchedAt).getTime();

    if (cache.collectionTitle !== collectionTitle || age > cacheMs) {
      return null;
    }

    return cache.items;
  } catch {
    return null;
  }
}

function writeRaindropCache(collectionTitle: string, items: RaindropItem[]) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(
    CACHE_PATH,
    JSON.stringify(
      {
        collectionTitle,
        fetchedAt: new Date().toISOString(),
        items,
      } satisfies RaindropCache,
      null,
      2,
    ),
  );
}

export async function fetchRaindropItems(
  options: LinkblogRaindropOptions = {},
) {
  const config = getLinkblogRaindropConfig(options);
  const token = requireToken(config.token);
  const cachedItems = config.refresh
    ? null
    : readRaindropCache(config.collectionTitle, config.cacheMs);

  if (cachedItems) {
    return cachedItems;
  }

  const collection = await getRaindropCollection(token, config.collectionTitle);

  if (!collection) {
    throw new Error(
      `Could not find Raindrop collection "${config.collectionTitle}"`,
    );
  }

  const items: RaindropItem[] = [];
  let page = 0;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total) {
    const params = new URLSearchParams({ perpage: "50", page: String(page) });
    const response = await raindropFetch<{
      count: number;
      items: RaindropItem[];
    }>(token, `/raindrops/${collection._id}?${params}`);

    total = response.count;
    items.push(...response.items);
    page += 1;

    if (response.items.length === 0) break;
  }

  writeRaindropCache(config.collectionTitle, items);

  return items;
}

export function readExistingLinkblog(vaultPath: string) {
  const linkblogDir = path.join(vaultPath, "Linkblog");
  const publicLinksToPages = new Map<string, Set<string>>();
  const pages = new Map<string, { markdown: string; public: boolean }>();

  for (const filePath of collectMarkdownFiles(linkblogDir)) {
    const markdown = fs.readFileSync(filePath, "utf8");
    const publicPage = frontmatterPublic(markdown);
    const relativePath = displayPath(vaultPath, filePath);

    pages.set(filePath, { markdown, public: publicPage });

    if (publicPage) {
      for (const link of extractMarkdownLinks(markdown)) {
        const pages = publicLinksToPages.get(link) ?? new Set<string>();
        pages.add(relativePath);
        publicLinksToPages.set(link, pages);
      }
    }
  }

  return { publicLinksToPages, pages };
}

export async function getLinkblogRaindropStatus(
  options: LinkblogRaindropOptions = {},
): Promise<LinkblogRaindropStatus> {
  const config = getLinkblogRaindropConfig(options);
  const raindrops = await fetchRaindropItems(config);
  const existing = readExistingLinkblog(config.vaultPath);
  const completed: LinkblogRaindropStatusItem[] = [];
  const todo: LinkblogRaindropStatusItem[] = [];

  for (const item of raindrops) {
    const normalizedLink = normalizeUrl(item.link);
    const date = dateFromRaindrop(item);
    const draftPage = displayPath(
      config.vaultPath,
      linkblogPathForDate(config.vaultPath, date),
    );
    const publicLinkPages = existing.publicLinksToPages.get(normalizedLink);
    const existingPage = publicLinkPages?.has(draftPage)
      ? draftPage
      : undefined;
    const statusItem: LinkblogRaindropStatusItem = {
      id: item._id,
      title: item.title,
      link: item.link,
      normalizedLink,
      excerpt: item.excerpt ?? "",
      created: item.created,
      date,
      existingPage,
      draftPage,
    };

    if (existingPage) {
      completed.push(statusItem);
    } else {
      todo.push(statusItem);
    }
  }

  todo.sort((a, b) => a.created.localeCompare(b.created));
  completed.sort((a, b) => b.created.localeCompare(a.created));

  const todoByDate: Record<string, LinkblogRaindropStatusItem[]> = {};
  const allDates = new Set<string>();

  for (const item of completed) {
    allDates.add(item.date);
  }

  for (const item of todo) {
    allDates.add(item.date);
    todoByDate[item.date] ??= [];
    todoByDate[item.date].push(item);
  }

  const todoDays = Object.keys(todoByDate).length;

  return {
    collectionTitle: config.collectionTitle,
    total: raindrops.length,
    totalDays: allDates.size,
    completedDays: allDates.size - todoDays,
    todoDays,
    completed,
    todo,
    todoByDate,
  };
}

function renderDraftItem(item: LinkblogRaindropStatusItem) {
  const lines = [`[${markdownEscape(item.title)}](${item.link})`, ""];

  if (isYouTubeUrl(item.link)) {
    lines.push(`![](${item.link})`, "");
  }

  const excerpt = item.excerpt.trim();
  if (excerpt) {
    for (const line of excerpt.split("\n")) {
      lines.push(`> ${line}`.trimEnd());
    }
    lines.push("");
  }

  lines.push("...");
  return lines.join("\n");
}

function draftFrontmatter() {
  return [
    "---",
    "public: false",
    'description: ""',
    'og-image: ""',
    "---",
    "",
  ].join("\n");
}

export async function writeLinkblogRaindropDrafts(
  options: LinkblogRaindropOptions = {},
) {
  const config = getLinkblogRaindropConfig(options);
  const status = await getLinkblogRaindropStatus(config);
  const existing = readExistingLinkblog(config.vaultPath);
  const written: string[] = [];
  const skippedPublic: string[] = [];

  for (const [date, items] of Object.entries(status.todoByDate)) {
    const filePath = linkblogPathForDate(config.vaultPath, date);
    const existingPage = existing.pages.get(filePath);

    if (existingPage?.public) {
      skippedPublic.push(displayPath(config.vaultPath, filePath));
      continue;
    }

    const existingMarkdown = existingPage?.markdown ?? draftFrontmatter();
    const existingLinks = extractMarkdownLinks(existingMarkdown);
    const newItems = items.filter(
      (item) => !existingLinks.has(item.normalizedLink),
    );

    if (newItems.length === 0) continue;

    const separator =
      existingPage && existingMarkdown.trimEnd() ? "\n\n---\n\n" : "";
    const newMarkdown = `${existingMarkdown.trimEnd()}${separator}${newItems
      .map(renderDraftItem)
      .join("\n\n---\n\n")}\n`;

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, newMarkdown);
    written.push(displayPath(config.vaultPath, filePath));
  }

  return { written, skippedPublic, status };
}

export async function syncDoneLinkblogRaindrops(
  options: LinkblogRaindropSyncDoneOptions = {},
): Promise<LinkblogRaindropSyncDoneResult> {
  const config = getLinkblogRaindropConfig(options);
  const token = requireToken(config.token);
  const apply = options.apply ?? false;
  const status = await getLinkblogRaindropStatus({ ...config, refresh: true });
  const existing = readExistingLinkblog(config.vaultPath);
  const ready: LinkblogRaindropSyncDoneItem[] = [];
  const remaining: LinkblogRaindropStatusItem[] = [];

  for (const item of status.todo) {
    const pagePath = linkblogPathForDate(config.vaultPath, item.date);
    const page = existing.pages.get(pagePath);

    if (page?.public) {
      ready.push({ ...item, reason: "public-day-page" });
      continue;
    }

    remaining.push(item);
  }

  let importedCollectionCreated = false;
  const moved: LinkblogRaindropSyncDoneItem[] = [];

  if (apply && ready.length > 0) {
    let importedCollection = await getRaindropCollection(
      token,
      config.importedCollectionTitle,
    );

    if (!importedCollection) {
      importedCollection = await createRaindropCollection(
        token,
        config.importedCollectionTitle,
      );
      importedCollectionCreated = true;
    }

    for (const item of ready) {
      await moveRaindropToCollection(token, item.id, importedCollection._id);
      moved.push(item);
    }

    clearRaindropCache();
  }

  return {
    apply,
    collectionTitle: config.collectionTitle,
    importedCollectionTitle: config.importedCollectionTitle,
    importedCollectionCreated,
    moved,
    ready: apply ? [] : ready,
    remaining,
  };
}
