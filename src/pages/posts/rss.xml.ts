import rss from "@astrojs/rss";
import { addCorsHeaders, createCorsOptionsResponse } from "../../utils";

export const prerender = false;

export const GET = async () => {
  const res = await rss({
    title: "Posts - jackharrhy.dev",
    description: "Posts from Jack Harrhy",
    site: import.meta.env.SITE,
    xmlns: {
      media: "http://search.yahoo.com/mrss/",
    },
    items: [],
    customData: `<language>en-us</language>`,
    stylesheet: "/rss/styles/general.xsl",
  });

  return addCorsHeaders(res);
};

export const OPTIONS = createCorsOptionsResponse;
