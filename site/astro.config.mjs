import { defineConfig } from "astro/config";

import node from "@astrojs/node";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

import metaTags from "astro-meta-tags";
import remarkWikiLink from "remark-wiki-link";

const slugify = (filename) =>
  filename.replace(".mdx", "").toLowerCase().replace(/\s+/g, "-");

// https://astro.build/config
export default defineConfig({
  site: "https://jackharrhy.dev",
  adapter: node({
    mode: "standalone",
  }),
  security: {
    checkOrigin: false,
  },
  integrations: [
    tailwind(),
    mdx({
      remarkPlugins: [
        [
          remarkWikiLink,
          {
            pageResolver: (name) => [slugify(name)],
            hrefTemplate: (permalink) =>
              permalink === "home" ? "/" : `/${permalink}`,
          },
        ],
      ],
    }),
    metaTags(),
  ],
});
