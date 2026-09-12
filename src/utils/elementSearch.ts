/**
 * Name search over everything drawn on a project's canvases.
 *
 * Split from the search bar so the matching is a pure function that can be
 * tested on its own, and so the per-keystroke cost is a scan of a prebuilt
 * index rather than a fresh walk of the model plus a domain lookup per hit.
 */
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { getElementDomainId, getModelDomains } from './domains';

export type SearchableKind = 'system' | 'container' | 'component' | 'code';

export type ElementSearchHit = {
  id: string;
  name: string;
  kind: SearchableKind;
  technology?: string;
  domainName?: string;
  /** Owning system / container — what tells two same-named services apart. */
  parentPath?: string;
};

export type ElementSearchIndex = Array<{
  hit: ElementSearchHit;
  /** Lowercased name, precomputed: the only thing matched against. */
  haystack: string;
}>;

type BlockLike = {
  id?: string;
  name?: string;
  technology?: string;
  systemId?: string;
  containerId?: string;
  componentId?: string;
  domainId?: string;
  original?: { id?: string };
};

/** What counts as a word start inside an element name. */
const SEPARATOR = /[\s\-_./:]/;

export function buildElementSearchIndex(
  model: FlatC4Model | null | undefined
): ElementSearchIndex {
  if (!model) return [];

  const domainNames = new Map(getModelDomains(model).map((d) => [d.id, d.name]));
  const systemNames = new Map(
    (model.systems || []).map((s) => [s.id, String(s.name || '')])
  );
  const containerNames = new Map(
    (model.containers || []).map((c) => [c.id, String(c.name || '')])
  );
  const componentParents = new Map(
    (model.components || []).map((c) => [
      c.id,
      { name: String(c.name || ''), containerId: (c as BlockLike).containerId },
    ])
  );

  const index: ElementSearchIndex = [];

  const add = (raw: unknown, kind: SearchableKind, parents: Array<string | undefined>) => {
    const block = raw as BlockLike;
    /* Clones are projections of an original the search finds through its own
       project, so listing them would only double every row. */
    if (!block?.id || block.original?.id) return;
    const name = String(block.name || '');
    if (!name) return;
    const domainId = getElementDomainId(block);
    index.push({
      haystack: name.toLowerCase(),
      hit: {
        id: block.id,
        name,
        kind,
        technology: block.technology,
        domainName: domainId ? domainNames.get(domainId) : undefined,
        parentPath: parents.filter(Boolean).join(' / ') || undefined,
      },
    });
  };

  for (const s of model.systems || []) add(s, 'system', []);
  for (const c of model.containers || []) {
    add(c, 'container', [systemNames.get((c as BlockLike).systemId || '')]);
  }
  for (const c of model.components || []) {
    const block = c as BlockLike;
    add(c, 'component', [
      systemNames.get(block.systemId || ''),
      containerNames.get(block.containerId || ''),
    ]);
  }
  for (const c of model.codeElements || []) {
    const block = c as BlockLike;
    const parent = componentParents.get(block.componentId || '');
    add(c, 'code', [
      containerNames.get(parent?.containerId || ''),
      parent?.name,
    ]);
  }

  return index;
}

/**
 * Rank of `haystack` against a query, lower is better. `-1` means no match.
 *
 * A single word is matched as typed — `corp-marketplace` never answers with
 * `corp-abm-gateway`. Splitting into words is opt-in by typing a space, so
 * "marketplace api" still finds `corp-marketplace-analytics-api`.
 */
export function matchRank(haystack: string, needle: string, tokens: string[]): number {
  if (haystack === needle) return 0;
  if (haystack.startsWith(needle)) return 1;

  const at = haystack.indexOf(needle);
  /* A hit right after a separator reads as intentional; one in the middle of a
     word is usually incidental. */
  if (at >= 0) return SEPARATOR.test(haystack[at - 1] || '') ? 2 : 3;

  if (tokens.length > 1 && tokens.every((token) => haystack.includes(token))) return 4;
  return -1;
}

export function searchElementIndex(
  index: ElementSearchIndex,
  query: string
): ElementSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const tokens = needle.split(/\s+/).filter(Boolean);

  const ranked: Array<{ rank: number; entry: ElementSearchIndex[number] }> = [];
  for (const entry of index) {
    const rank = matchRank(entry.haystack, needle, tokens);
    if (rank >= 0) ranked.push({ rank, entry });
  }

  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      /* Shorter names carry the query as more of their meaning. */
      a.entry.haystack.length - b.entry.haystack.length ||
      a.entry.hit.name.localeCompare(b.entry.hit.name)
  );

  return ranked.map((r) => r.entry.hit);
}
