import fs from "node:fs/promises";
import path from "node:path";

import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const requestedPath = params.path;

  if (!requestedPath) {
    return new Response("Path required", { status: 400 });
  }

  const extension = path.extname(requestedPath).toLowerCase();
  let contentType: string;

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      contentType = "image/jpeg";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".svg":
      contentType = "image/svg+xml";
      break;
    case ".gif":
      contentType = "image/gif";
      break;
    case ".webp":
      contentType = "image/webp";
      break;
    case ".mp3":
      contentType = "audio/mpeg";
      break;
    case ".wav":
      contentType = "audio/wav";
      break;
    case ".ogg":
      contentType = "audio/ogg";
      break;
    default:
      return new Response("Unsupported file type", { status: 400 });
  }

  if (import.meta.env.DEV) {
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
  }

  // TODO redirect to r2

  return new Response(
    JSON.stringify({
      params,
    })
  );
};
