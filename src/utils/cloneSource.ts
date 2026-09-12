import type { Node } from '@xyflow/react';
import type { CloneOriginalRef } from '@/types/c4Extensions';

/*
 * A clone card is created by copying the original block's fields and keeping a
 * pointer back to it (`original: { id, type, projectId? }`). Community edition
 * resolves in-project clones only — remote / cross-project originals are ignored.
 */

const CLONE_OWN_FIELDS = new Set([
  'id',
  'position',
  'original',
  'systemId',
  'containerId',
  'componentId',
  'connections',
]);

type CloneRef = CloneOriginalRef;
type Block = { id: string; original?: CloneRef };
type ModelLike = {
  systems?: Block[];
  containers?: Block[];
  components?: Block[];
  codeElements?: Block[];
};

const COLLECTIONS: (keyof ModelLike)[] = ['systems', 'containers', 'components', 'codeElements'];

export function subscribeRemoteOriginalCache(_listener: () => void): () => void {
  return () => {};
}

export function getRemoteOriginalCacheVersion(): number {
  return 0;
}

export function getCachedRemoteOriginalMeta(
  _projectId: string,
  _elementId: string
): { element: Record<string, unknown> | null; domainName?: string; projectName?: string } | undefined {
  return undefined;
}

export async function prefetchRemoteOriginal(
  _projectId: string,
  _elementId: string
): Promise<Record<string, unknown> | null> {
  return null;
}

export function getCachedRemoteOriginal(
  _projectId: string,
  _elementId: string
): Record<string, unknown> | null | undefined {
  return undefined;
}

export function clearRemoteOriginalCache(): void {}

export function findCloneOriginal(model: ModelLike | null | undefined, ref: CloneRef | undefined) {
  if (!model || !ref?.id) return null;
  if (ref.projectId) return null;
  for (const key of COLLECTIONS) {
    const found = model[key]?.find((item) => item?.id === ref.id && !item?.original);
    if (found) return found;
  }
  return null;
}

export function cloneContentFrom(original: Record<string, unknown>): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(original)) {
    if (CLONE_OWN_FIELDS.has(key)) continue;
    content[key] = value;
  }
  return content;
}

/**
 * The id content must be written to. A clone is a view of another block, so
 * anything attached to it — documentation, sequence diagrams — belongs on the
 * original.
 */
export function resolveOriginalId(model: ModelLike | null | undefined, id: string): string {
  if (!model || !id) return id;
  for (const key of COLLECTIONS) {
    const found = model[key]?.find((item) => item?.id === id);
    if (found) return found.original?.id || id;
  }
  return id;
}

export function isCloneBlock(item: unknown): boolean {
  return Boolean((item as { original?: CloneRef } | null)?.original?.id);
}

export function isRemoteCloneBlock(item: unknown): boolean {
  const original = (item as { original?: CloneRef } | null)?.original;
  return Boolean(original?.id && original.projectId);
}

/** Nodes with the live content of whatever their clones point at (in-project). */
export function resolveCloneNodes(nodes: Node[], model: ModelLike | null | undefined): Node[] {
  if (!model) return nodes;

  let changed = false;
  const resolved = nodes.map((node) => {
    const data = node.data as (Record<string, unknown> & Block) | undefined;
    const ref = data?.original;
    if (!ref?.id) return node;
    if (ref.projectId) return node;

    const original = findCloneOriginal(model, ref) as Record<string, unknown> | null;
    if (!original) return node;

    const content = cloneContentFrom(original);
    const same = Object.keys(content).every(
      (key) => (data as Record<string, unknown>)[key] === content[key]
    );
    if (same) return node;

    changed = true;
    return { ...node, data: { ...data, ...content } };
  });

  return changed ? resolved : nodes;
}
