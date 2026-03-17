// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';
import { remarkObsidian } from './lib/remark-obsidian.mjs';
import { rehypeObsidian } from './lib/rehype-obsidian.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://jackharrhy.dev',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [tailwind()],
  server: {
    host: '0.0.0.0',
    port: 4321,
  },
  markdown: {
    remarkPlugins: [remarkObsidian],
    rehypePlugins: [rehypeObsidian],
  },
});
