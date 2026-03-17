import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const requestedPath = params.path;

  if (!requestedPath) {
    return new Response('Path required', { status: 400 });
  }

  // In production, redirect to R2 CDN
  if (import.meta.env.PROD) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://garden.jack.camera/${encodeURIComponent(requestedPath)}`,
      },
    });
  }

  // In development, serve from local vault assets
  const vaultAssetsPath = process.env.GARDEN_VAULT_ASSETS_PATH || './vault/assets';
  const assetPath = path.join(
    vaultAssetsPath,
    requestedPath
  );

  try {
    const file = await fs.readFile(assetPath);

    const contentType = mime.getType(requestedPath) || 'application/octet-stream';

    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(`Asset not found: ${assetPath}`, error);
    return new Response('File not found', { status: 404 });
  }
};
