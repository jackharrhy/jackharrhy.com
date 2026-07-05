import type { CollectionEntry } from "astro:content";

export type GardenEntry = CollectionEntry<"garden">;

export interface PageLayoutConfig {
  width?: string;
  centerHeader: boolean;
  mainClass?: string;
  noHeader: boolean;
  noFooter: boolean;
  invert: boolean;
  mobileFriendly: boolean;
}

export interface Breadcrumb {
  name: string;
  path?: string;
}

export function getPageLayoutConfig(customLayout: string | undefined, header: boolean): PageLayoutConfig {
  const config: PageLayoutConfig = {
    centerHeader: false,
    noHeader: !header,
    noFooter: !header,
    invert: false,
    mobileFriendly: true,
  };

  switch (customLayout) {
    case "quake":
      return {
        ...config,
        width: "max-w-full",
        centerHeader: true,
        mainClass: "quake-page prose-lg font-mono py-8",
        noFooter: true,
        invert: true,
      };
    case "terminal":
      return {
        ...config,
        width: "max-w-full",
        noHeader: true,
        mainClass: "bg-black prose-lg font-mono py-8 flex-1",
        noFooter: true,
        invert: true,
      };
    default:
      return config;
  }
}

export function getDisplayName(entry: GardenEntry): string {
  return entry.data.name || entry.id
    .split("/")
    .map((segment: string) => segment
      .split("-")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "))
    .join("/");
}

export function getPageTitle(displayName: string): string {
  const nameSegments = displayName.split("/");
  return nameSegments.length > 1 ? nameSegments[nameSegments.length - 1] : displayName;
}

export function shouldIncludeTitleInBreadcrumbs(entryId: string): boolean {
  return entryId.startsWith("devblog/") || entryId.startsWith("linkblog/");
}

export function getBreadcrumbs(entry: GardenEntry, displayName: string, publicEntryIds: Set<string>): Breadcrumb[] {
  const idSegments = entry.id.split("/");
  const nameSegments = displayName.split("/");
  const includeTitle = shouldIncludeTitleInBreadcrumbs(entry.id);
  const breadcrumbs = nameSegments.length > 1
    ? includeTitle ? nameSegments : nameSegments.slice(0, -1)
    : [];

  return breadcrumbs.map((name, index) => {
    const segmentIndex = Math.min(index, idSegments.length - 1);
    const path = idSegments.slice(0, segmentIndex + 1).join("/").toLowerCase();
    return {
      name,
      path: publicEntryIds.has(path) && path !== entry.id ? `/${path}` : undefined,
    };
  });
}

export function getRenderedTitle(entry: GardenEntry, displayName: string): string {
  const pageTitle = getPageTitle(displayName);
  return shouldIncludeTitleInBreadcrumbs(entry.id) && entry.data.description
    ? entry.data.description
    : pageTitle;
}
