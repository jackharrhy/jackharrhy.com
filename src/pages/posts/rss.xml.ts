import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export const GET = async () => {
  const posts = await getCollection("posts");

  return rss({
    title: "jackharrhy.dev - posts",
    description: "ramblings of mine",
    site: import.meta.env.SITE,
    items: posts
      .filter(({ data: { published } }) => published)
      .map(({ slug, data: { title, pubDate } }) => ({
        title,
        description: title,
        link: `${import.meta.env.SITE}/post/${slug}`,
        pubDate,
      })),
    customData: `<language>en-us</language>`,
    stylesheet: "/rss/styles/posts.xsl",
  });
};
