export const slugify = (name: string): string => {
  let slug = name
    .replace("?", "")
    .replace(" ", "-")
    .replace("&", "and")
    .replace(".", "-")
    .replace(":", "-")
    .replace("'", "");

  while (slug.includes("--")) {
    slug = slug.replace("--", "-");
  }

  return slug;
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
