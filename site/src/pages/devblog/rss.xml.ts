import rss from "@astrojs/rss";
import { getDevblogPosts, projectNameToBetterName } from "../../feeds";

export const prerender = false;

export const GET = async () => {
  const items = await getDevblogPosts();

  const now = new Date();
  const nst = new Date(
    now.toLocaleString("en-US", { timeZone: "America/St_Johns" })
  );
  const todayAt8AM = new Date(nst);
  todayAt8AM.setHours(8, 0, 0, 0);

  const rssItems = items
    .map((post) => {
      const [_, project, year, month, day] = post.id.match(
        /^devblog\/([^\/]+)\/(\d{4})\/(\d{2})\/(\d{2})$/
      )!;
      const projectName =
        projectNameToBetterName[
          project as keyof typeof projectNameToBetterName
        ];
      return {
        title: `${projectName} - ${post.data.description}`,
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
    title: "Devblog - jackharrhy.dev",
    description: "Devblog from Jack Harrhy",
    site: import.meta.env.SITE,
    items: rssItems,
    customData: `<language>en-us</language>`,
    stylesheet: "/rss/styles/general.xsl",
  });
};
