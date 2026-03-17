import fs from 'node:fs/promises';
import path from 'node:path';
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
  const assetPath = path.join(
    '/workspace/extra/vault/assets',
    requestedPath
  );

  try {
    const file = await fs.readFile(assetPath);

    // Determine content type from extension
    const ext = path.extname(requestedPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

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
