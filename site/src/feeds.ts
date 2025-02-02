import { getCollection } from "astro:content";

export const getLinkblogPosts = async () => {
  const collection = await getCollection("garden");

  const linkblogPosts = collection.filter((entry) =>
    entry.id.startsWith("linkblog/")
  );
  const items = linkblogPosts.filter((post) =>
    /^linkblog\/\d{4}\/\d{2}\/\d{2}$/.test(post.id)
  );

  items.reverse();

  return items;
};

export const getLinkblogPostsAsTree = async () => {
  const items = await getLinkblogPosts();

  const tree: Record<
    string,
    Record<string, Record<string, (typeof items)[0]>>
  > = {};

  for (const post of items) {
    const [_, year, month, day] = post.id.match(
      /^linkblog\/(\d{4})\/(\d{2})\/(\d{2})$/
    )!;

    if (!tree[year]) {
      tree[year] = {};
    }
    if (!tree[year][month]) {
      tree[year][month] = {};
    }
    tree[year][month][day] = post;
  }

  return tree;
};
