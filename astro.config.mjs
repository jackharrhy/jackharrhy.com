// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/** @type {import('astro').AstroIntegration} */
const watchLib = {
  name: "watch-lib",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.watcher.add(path.resolve("./lib"));
      server.watcher.on("change", (file) => {
        if (file.includes("/lib/")) {
          server.restart();
        }
      });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: "https://jackharrhy.dev",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [watchLib],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    host: "0.0.0.0",
    port: 4321,
  },
  markdown: {
    shikiConfig: {
      langAlias: {
        component: "plaintext",
      },
    },
  },
});
