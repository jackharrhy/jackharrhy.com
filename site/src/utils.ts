export const slugify = (name: string): string => {
  let slug = name
    .replace("?", "")
    .replace(" ", "-")
    .replace("&", "and")
    .replace(".", "-")
    .replace(":", "-")
    .replace("'", "");

  while (slug.includes("--")) {
    slug = slug.replace("--", "-");
  }

  return slug;
};
