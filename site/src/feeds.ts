import { getCollection } from "astro:content";

export const projectNameToBetterName = {
  "quakeless-ii": "Quakeless II",
};

export const deslugify = (slug: string) => {
  if (slug.startsWith("devblog/")) {
    const parts = slug.split("/");
    const project = parts[1];
    return (
      projectNameToBetterName[project as keyof typeof projectNameToBetterName] +
      ": " +
      parts.slice(2).join("/").replace(/-/g, " ")
    );
  } else {
    return slug.replace(/-/g, " ").replace(/^linkblog\//, "");
  }
};

export const getPosts = async (source: string) => {
  switch (source) {
    case "linkblog":
      return await getLinkblogPosts();
    case "devblog":
      return await getDevblogPosts();
    default:
      throw new Error("unknown source");
  }
};

export const getPostsAsTree = async (source: string) => {
  switch (source) {
    case "linkblog":
      return await getLinkblogPostsAsTree();
    case "devblog":
      return await getDevblogPostsAsTree();
    default:
      throw new Error("unknown source");
  }
};
export const getLinkblogPosts = async () => {
  const collection = await getCollection("garden");

  const linkblogPosts = collection.filter((entry) =>
    entry.id.startsWith("linkblog/")
  );
  const items = linkblogPosts.filter((post) =>
    /^linkblog\/\d{4}\/\d{2}\/\d{2}$/.test(post.id)
  );

  return items.sort((a, b) => b.id.localeCompare(a.id));
};

export const getDevblogPosts = async () => {
  const collection = await getCollection("garden");

  const devblogPosts = collection.filter((entry) =>
    entry.id.startsWith("devblog/")
  );

  const items = devblogPosts.filter((post) =>
    /^devblog\/[^\/]+\/\d{4}\/\d{2}\/\d{2}$/.test(post.id)
  );

  return items.sort((a, b) => b.id.localeCompare(a.id));
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

export const getDevblogPostsAsTree = async () => {
  const items = await getDevblogPosts();

  const tree: Record<
    string,
    Record<string, Record<string, (typeof items)[0]>>
  > = {};

  for (const post of items) {
    const [_, project, year, month, day] = post.id.match(
      /^devblog\/([^\/]+)\/(\d{4})\/(\d{2})\/(\d{2})$/
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
