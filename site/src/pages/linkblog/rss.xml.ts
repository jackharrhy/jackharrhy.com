import rss from "@astrojs/rss";
import { getLinkblogPosts } from "../../feeds";

export const prerender = false;

export const GET = async () => {
  const items = await getLinkblogPosts();

  const now = new Date();
  const nst = new Date(
    now.toLocaleString("en-US", { timeZone: "America/St_Johns" })
  );
  const todayAt8AM = new Date(nst);
  todayAt8AM.setHours(8, 0, 0, 0);

  const rssItems = items
    .map((post) => {
      const [_, year, month, day] = post.id.match(
        /^linkblog\/(\d{4})\/(\d{2})\/(\d{2})$/
      )!;
      return {
        title: `${post.id.replace("linkblog/", "")} - ${post.data.description}`,
        link: `${import.meta.env.SITE}/${post.id}`,
        pubDate: new Date(`${year}-${month}-${day}`),
      };
    })
    .filter((item) => {
      const itemDate = item.pubDate;
      return itemDate < todayAt8AM;
    })
    .slice(0, 10);

  return rss({
    title: "Link blog - jackharrhy.dev",
    description: "Link blog from Jack Harrhy",
    site: import.meta.env.SITE,
    items: rssItems,
    customData: `<language>en-us</language>`,
    stylesheet: "/rss/styles/general.xsl",
  });
};
