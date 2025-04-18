import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

const garden = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/data/garden" }),
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    customLayout: z.string().optional(),
    ogImage: z.string().optional(),
  }),
});

export const collections = { garden };
