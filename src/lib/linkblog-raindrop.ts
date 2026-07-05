import fs from "node:fs";
import path from "node:path";

export type RaindropItem = {
  _id: number;
  title: string;
  link: string;
  excerpt?: string;
  created: string;
};

export type LinkblogRaindropOptions = {
  token?: string;
  collectionTitle?: string;
  vaultPath?: string;
};

export type LinkblogRaindropStatus = {
  collectionTitle: string;
  total: number;
  completed: LinkblogRaindropStatusItem[];
  todo: LinkblogRaindropStatusItem[];
  todoByDate: Record<string, LinkblogRaindropStatusItem[]>;
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

export function getLinkblogRaindropConfig(
  options: LinkblogRaindropOptions = {},
) {
  return {
    token: options.token ?? process.env.GARDEN_RAINDROP_TOKEN,
    collectionTitle:
      options.collectionTitle ??
      process.env.GARDEN_RAINDROP_COLLECTION ??
      DEFAULT_COLLECTION_TITLE,
    vaultPath: path.resolve(
      options.vaultPath ?? process.env.GARDEN_VAULT_PATH ?? "./vault/Garden",
    ),
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

async function raindropFetch<T>(token: string, pathname: string): Promise<T> {
  const response = await fetch(`${RAINDROP_API_BASE}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Raindrop request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchRaindropItems(
  options: LinkblogRaindropOptions = {},
) {
  const config = getLinkblogRaindropConfig(options);
  const token = requireToken(config.token);
  const collections = await raindropFetch<{
    items: { _id: number; title: string }[];
  }>(token, "/collections");
  const collection = collections.items.find(
    (item) => item.title === config.collectionTitle,
  );

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

  return items;
}

export function readExistingLinkblog(vaultPath: string) {
  const linkblogDir = path.join(vaultPath, "Linkblog");
  const linksToPages = new Map<string, string>();
  const pages = new Map<string, { markdown: string; public: boolean }>();

  for (const filePath of collectMarkdownFiles(linkblogDir)) {
    const markdown = fs.readFileSync(filePath, "utf8");
    const publicPage = frontmatterPublic(markdown);
    const relativePath = displayPath(vaultPath, filePath);

    pages.set(filePath, { markdown, public: publicPage });

    for (const link of extractMarkdownLinks(markdown)) {
      linksToPages.set(link, relativePath);
    }
  }

  return { linksToPages, pages };
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
    const existingPage = existing.linksToPages.get(normalizedLink);
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
  for (const item of todo) {
    todoByDate[item.date] ??= [];
    todoByDate[item.date].push(item);
  }

  return {
    collectionTitle: config.collectionTitle,
    total: raindrops.length,
    completed,
    todo,
    todoByDate,
  };
}

function renderDraftItem(item: LinkblogRaindropStatusItem) {
  const lines = [`[${markdownEscape(item.title)}](${item.link})`, ""];

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
