/**
 * Resolve an og-image value from frontmatter.
 * Handles Obsidian wikilink syntax: "![[filename.png]]" or "![[filename.png|WxH]]"
 * Returns a proper /asset/ URL, or passes through already-resolved URLs unchanged.
 */
export const resolveOgImage = (
  ogImage: string | undefined,
): string | undefined => {
  if (!ogImage) return undefined;

  // Match ![[filename]] or ![[filename|WxH]]
  const wikilinkMatch = ogImage.match(/^!?\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]$/);
  if (wikilinkMatch) {
    return `/asset/${wikilinkMatch[1]}`;
  }

  return ogImage;
};

export const getImageType = (ogImage: string | undefined): string => {
  if (!ogImage) return "image/png";

  switch (true) {
    case ogImage.endsWith(".jpg"):
    case ogImage.endsWith(".jpeg"):
      return "image/jpeg";
    case ogImage.endsWith(".webp"):
      return "image/webp";
    case ogImage.endsWith(".png"):
      return "image/png";
    default:
      return "image/png";
  }
};

export const createImageCustomData = (ogImage: string | undefined): string => {
  if (!ogImage) return "";

  const imageType = getImageType(ogImage);
  const url = new URL(ogImage, import.meta.env.SITE);
  return `<media:content
    type="${imageType}"
    medium="image"
    url="${url.href}" />`;
};

export const addCorsHeaders = (response: Response): Response => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
};

export const createCorsOptionsResponse = () =>
  new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
