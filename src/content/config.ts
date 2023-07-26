import { z, defineCollection } from "astro:content";

const postsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    tags: z.array(z.string()),
    pubDate: z.date(),
    published: z.boolean().default(true),
  }),
});

export const collections = {
  posts: postsCollection,
};
