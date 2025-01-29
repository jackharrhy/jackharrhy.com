import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";

import remarkWikiLink from "remark-wiki-link";

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind(),
    mdx({
      remarkPlugins: [
        [
          remarkWikiLink,
          {
            pageResolver: (name) => [name.toLowerCase().replace(/\s+/g, "-")],
            hrefTemplate: (permalink) => permalink,
          },
        ],
      ],
    }),
  ],
});
