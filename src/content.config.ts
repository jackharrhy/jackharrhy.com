import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { canonicalRouteId } from "../lib/garden-routing.mjs";

const GARDEN_VAULT_PATH = process.env.GARDEN_VAULT_PATH || "./vault/Garden";

const garden = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: GARDEN_VAULT_PATH,
    generateId: ({ entry }) => canonicalRouteId(entry),
  }),
  schema: z.object({
    public: z.boolean().default(false),
    description: z.string().optional(),
    "og-image": z.string().optional(),
    custom_layout: z.string().optional(),
    "custom-layout": z.string().optional(),

    title: z.string().optional(),
    date: z.date().optional(),
    tags: z.array(z.string()).optional(),

    // Component properties (for Feed, Mug, NowPlaying, etc.)
    component: z.string().optional(),
    name: z.string().optional(),
    link: z.string().optional(),
    image: z.string().optional(),
    variant: z.string().optional(),
    source: z.string().optional(),
    limit: z.number().optional(),
  }),
});

export const collections = {
  garden,
};
