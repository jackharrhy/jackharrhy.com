// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { remarkObsidian } from './lib/remark-obsidian.mjs';
import { rehypeObsidian } from './lib/rehype-obsidian.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://jackharrhy.dev',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    host: '0.0.0.0',
    port: 4321,
  },
  markdown: {
    remarkPlugins: [remarkObsidian],
    rehypePlugins: [rehypeObsidian],
  },
});
