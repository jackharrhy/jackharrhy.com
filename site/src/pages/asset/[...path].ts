import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime";

import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const requestedPath = params.path;

  if (!requestedPath) {
    return new Response("Path required", { status: 400 });
  }

  if (!import.meta.env.DEV) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://garden.jack.camera/${encodeURIComponent(
          requestedPath
        )}`,
      },
    });
  }

  const extension = path.extname(requestedPath).toLowerCase();
  const contentType = mime.getType(extension);

  let thisFile = import.meta.url.replace("file:", "");

  let filePath = path.join(
    thisFile,
    "..",
    "..",
    "..",
    "..",
    "..",
    "logseq",
    "assets",
    requestedPath
  );

  try {
    const file = await fs.readFile(filePath);
    return new Response(file, {
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (e) {
    console.error(e);
    return new Response("File not found", { status: 404 });
  }
};
