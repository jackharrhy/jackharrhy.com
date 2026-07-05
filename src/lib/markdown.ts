import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { remarkObsidian } from "../../lib/remark-obsidian.mjs";
import { rehypeObsidian } from "../../lib/rehype-obsidian.mjs";
import { buildGardenIndexFromVault } from "../../lib/garden-routing.mjs";

export type ProseSegment = { type: "prose"; content: string };
export type ComponentSegment = { type: "component"; props: Record<string, string> };
export type Segment = ProseSegment | ComponentSegment;
export type RenderedSegment = string | ComponentSegment;

let cachedGardenIndex: ReturnType<typeof buildGardenIndexFromVault> | undefined;
let cachedMarkdownProcessor: Awaited<ReturnType<typeof createMarkdownProcessor>> | undefined;

function parseComponentBlock(value: string): Record<string, string> | null {
  const lines = value
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const props: Record<string, string> = { component: lines[0] };
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(":");
    if (colon === -1) continue;
    props[lines[i].slice(0, colon).trim()] = lines[i].slice(colon + 1).trim();
  }

  return props;
}

export function splitIntoSegments(body: string): Segment[] {
  const segments: Segment[] = [];
  const re = /^```component\n([\s\S]*?)^```/gm;
  let lastIndex = 0;
  let match;

  while ((match = re.exec(body)) !== null) {
    const before = body.slice(lastIndex, match.index).trim();
    if (before) segments.push({ type: "prose", content: before });

    const props = parseComponentBlock(match[1]);
    if (props) segments.push({ type: "component", props });

    lastIndex = match.index + match[0].length;
  }

  const remaining = body.slice(lastIndex).trim();
  if (remaining) segments.push({ type: "prose", content: remaining });

  return segments;
}

function getGardenIndex() {
  const gardenIndex = import.meta.env.DEV
    ? buildGardenIndexFromVault(process.env.GARDEN_VAULT_PATH || "./vault/Garden")
    : cachedGardenIndex ??= buildGardenIndexFromVault(process.env.GARDEN_VAULT_PATH || "./vault/Garden");

  const routeCollisions = gardenIndex.collisions.filter((collision) => collision.type === "route");

  if (routeCollisions.length > 0) {
    throw new Error(
      `Garden route collisions: ${routeCollisions
        .map((collision) => `${collision.key} (${collision.entries.map((entry) => entry.sourcePath).join(", ")})`)
        .join("; ")}`,
    );
  }

  return gardenIndex;
}

async function getMarkdownProcessor() {
  if (import.meta.env.DEV) {
    return createMarkdownProcessor({
      remarkPlugins: [[remarkObsidian, { gardenIndex: getGardenIndex() }]],
      rehypePlugins: [rehypeObsidian],
    });
  }

  if (!cachedMarkdownProcessor) {
    cachedMarkdownProcessor = await createMarkdownProcessor({
      remarkPlugins: [[remarkObsidian, { gardenIndex: getGardenIndex() }]],
      rehypePlugins: [rehypeObsidian],
    });
  }

  return cachedMarkdownProcessor;
}

export async function renderMarkdownSegments(body: string): Promise<RenderedSegment[]> {
  const processor = await getMarkdownProcessor();
  const renderedSegments: RenderedSegment[] = [];

  for (const segment of splitIntoSegments(body)) {
    if (segment.type === "component") {
      renderedSegments.push(segment);
    } else {
      const file = await processor.render(segment.content);
      renderedSegments.push(file.code);
    }
  }

  return renderedSegments;
}
