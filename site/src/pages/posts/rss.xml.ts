import rss from "@astrojs/rss";

export const prerender = false;

export const GET = async () => {
  return rss({
    title: "Posts - jackharrhy.dev",
    description: "Posts from Jack Harrhy",
    site: import.meta.env.SITE,
    items: [],
    customData: `<language>en-us</language>`,
    stylesheet: "/rss/styles/posts.xsl",
  });
};
