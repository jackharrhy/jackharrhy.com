import { defineConfig } from "astro/config";

import node from "@astrojs/node";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

import remarkWikiLink from "remark-wiki-link";

import fsSync from "fs";

const slugify = (filename) =>
  filename.replace(".mdx", "").toLowerCase().replace(/\s+/g, "-");

const getGardenFiles = (dir) => {
  const files = [];
  const entries = fsSync.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...getGardenFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      const relativePath = fullPath.replace("src/data/garden/", "");
      files.push(slugify(relativePath));
    }
  }

  return files;
};

const gardenFiles = getGardenFiles("src/data/garden");

const permalinks = [...gardenFiles, "debug", "404"];

console.log(permalinks);

// https://astro.build/config
export default defineConfig({
  adapter: node({
    mode: "standalone",
  }),
  integrations: [
    tailwind(),
    mdx({
      remarkPlugins: [
        [
          remarkWikiLink,
          {
            permalinks,
            pageResolver: (name) => [slugify(name)],
            hrefTemplate: (permalink) =>
              permalink === "home" ? "/" : `/${permalink}`,
          },
        ],
      ],
    }),
  ],
});
