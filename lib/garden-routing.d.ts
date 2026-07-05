export interface GardenEntryInput {
  path: string;
  kind?: 'note' | 'asset';
  aliases?: string[];
}

export interface GardenEntry {
  sourcePath: string;
  stemPath: string;
  basename: string;
  routeId: string;
  url: string;
  kind: 'note' | 'asset';
  aliases: string[];
}

export interface GardenIndex {
  entries: GardenEntry[];
  lookup: Map<string, GardenEntry[]>;
  routeIds: Map<string, GardenEntry>;
  collisions: { key: string; entries: GardenEntry[]; type: 'route' | 'lookup' }[];
}

export function slugifySegment(value: string): string;
export function canonicalRouteId(vaultRelativePath: string): string;
export function buildGardenIndex(entries: GardenEntryInput[], options?: { assetUrlPrefix?: string }): GardenIndex;
export function buildGardenIndexFromVault(vaultPath: string, options?: { assetUrlPrefix?: string }): GardenIndex;
export function parseWikiLink(raw: string): {
  targetText: string;
  label?: string;
  anchor?: string;
  embed: boolean;
};
export function resolveWikiLink(raw: string, index: GardenIndex):
  | {
      ok: true;
      raw: string;
      targetText: string;
      label?: string;
      anchor?: string;
      embed: boolean;
      target: GardenEntry;
      url: string;
      media: boolean;
    }
  | {
      ok: false;
      raw: string;
      targetText: string;
      label?: string;
      anchor?: string;
      embed: boolean;
      reason: 'not-found' | 'ambiguous';
      candidates?: GardenEntry[];
    };
