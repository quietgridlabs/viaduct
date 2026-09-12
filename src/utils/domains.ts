import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type {
  CloneOriginalRef,
  Domain,
  DomainExtras,
  DomainLevel,
  DomainMembership,
} from '@/types/c4Extensions';

export const DOMAIN_NAME_MAX = 64;
export const DOMAIN_DESCRIPTION_MAX = 160;

/** Palette offered for a domain accent — readable on both canvas themes. */
export const DOMAIN_COLORS = [
  '#1f75cb',
  '#108548',
  '#8b5cf6',
  '#e2793d',
  '#c9376e',
  '#0891b2',
  '#b7791f',
  '#64748b',
] as const;

export function normalizeDomainColor(raw: unknown): string | undefined {
  const value = String(raw ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : undefined;
}

type BlockLike = {
  id: string;
  name?: string;
  domainId?: string;
  original?: CloneOriginalRef;
  connections?: Array<{ targetId?: string }>;
};

function asDomainsModel(model: FlatC4Model | null | undefined): DomainExtras {
  return (model || {}) as FlatC4Model & DomainExtras;
}

export function newDomainId(): string {
  return `dom_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function normalizeDomainName(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, DOMAIN_NAME_MAX);
}

/** Read domain from model as stored — no trim (would break live typing in inputs). */
function readDomain(raw: unknown, keepUnnamed = false): Domain | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Domain;
  const name = String(rec.name ?? '').slice(0, DOMAIN_NAME_MAX);
  if (!keepUnnamed && !name.trim()) return null;
  const level: DomainLevel = rec.level === 'container' ? 'container' : 'system';
  const id = String(rec.id || '').trim();
  if (!id) return null;
  const description =
    rec.description != null
      ? String(rec.description).slice(0, DOMAIN_DESCRIPTION_MAX)
      : undefined;
  const color = normalizeDomainColor(rec.color);
  return {
    id,
    name,
    level,
    ...(description ? { description } : {}),
    ...(color ? { color } : {}),
  };
}

/** Normalize whitespace for API / persistence boundaries. */
export function sanitizeDomain(raw: unknown): Domain | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Domain;
  const name = normalizeDomainName(rec.name);
  if (!name) return null;
  const level: DomainLevel = rec.level === 'container' ? 'container' : 'system';
  const id = String(rec.id || '').trim() || newDomainId();
  const description = String(rec.description ?? '')
    .trim()
    .slice(0, DOMAIN_DESCRIPTION_MAX);
  const color = normalizeDomainColor(rec.color);
  return {
    id,
    name,
    level,
    ...(description ? { description } : {}),
    ...(color ? { color } : {}),
  };
}

export function getModelDomains(model: FlatC4Model | null | undefined): Domain[] {
  const list = asDomainsModel(model).domains;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => readDomain(raw)).filter((d): d is Domain => Boolean(d));
}

/**
 * Domains as stored, keeping the ones whose name is still empty.
 *
 * Every other reader wants those gone: an unnamed domain has nothing to show.
 * The editor is the exception — clearing the box is a normal step of typing a
 * name, and a domain that vanishes from the list mid-keystroke takes the open
 * editor down with it and gets written out of the model by the next save.
 */
export function getEditableDomains(model: FlatC4Model | null | undefined): Domain[] {
  const list = asDomainsModel(model).domains;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => readDomain(raw, true)).filter((d): d is Domain => Boolean(d));
}

export function domainsForLevel(
  model: FlatC4Model | null | undefined,
  level: DomainLevel
): Domain[] {
  return getModelDomains(model).filter((d) => d.level === level);
}

export function findDomain(
  model: FlatC4Model | null | undefined,
  domainId: string | undefined | null
): Domain | null {
  if (!domainId) return null;
  return getModelDomains(model).find((d) => d.id === domainId) || null;
}

export function getElementDomainId(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  return String((item as DomainMembership).domainId || '').trim();
}

export function withModelDomains(model: FlatC4Model, domains: Domain[]): FlatC4Model {
  return { ...model, domains } as FlatC4Model;
}

export type DomainMember = {
  id: string;
  name: string;
  type: 'system' | 'container';
  technology?: string;
  systemId?: string;
};

/** Non-clone systems/containers assigned to a domain. */
export function listDomainMembers(
  model: FlatC4Model | null | undefined,
  domainId: string | undefined | null
): DomainMember[] {
  if (!model || !domainId) return [];
  /* Membership depends on the domain's level, not on it having been named yet:
     reading the strict list here would empty the member list out from under
     anyone retyping the name. */
  const domain = getEditableDomains(model).find((d) => d.id === domainId) ?? null;
  if (!domain) return [];

  if (domain.level === 'system') {
    return ((model.systems || []) as BlockLike[])
      .filter((s) => s.domainId === domainId && !s.original)
      .map((s) => ({
        id: s.id,
        name: s.name || s.id,
        type: 'system' as const,
        technology: (s as { technology?: string }).technology,
      }));
  }

  return ((model.containers || []) as BlockLike[])
    .filter((c) => c.domainId === domainId && !c.original)
    .map((c) => ({
      id: c.id,
      name: c.name || c.id,
      type: 'container' as const,
      technology: (c as { technology?: string }).technology,
      systemId: (c as { systemId?: string }).systemId,
    }));
}

/** Clear domainId on systems/containers that pointed at a deleted domain. */
export function clearDomainMembership(
  model: FlatC4Model,
  domainId: string
): FlatC4Model {
  const clearList = <T extends { domainId?: string }>(list: T[] | undefined): T[] =>
    (list || []).map((item) =>
      item.domainId === domainId ? { ...item, domainId: undefined } : item
    );

  return {
    ...model,
    systems: clearList(model.systems as Array<{ domainId?: string }>),
    containers: clearList(model.containers as Array<{ domainId?: string }>),
  } as FlatC4Model;
}

export function isRemoteClone(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const original = (item as { original?: CloneOriginalRef }).original;
  return Boolean(original?.id && original.projectId);
}

export function cloneOriginalRef(item: unknown): CloneOriginalRef | null {
  if (!item || typeof item !== 'object') return null;
  const original = (item as { original?: CloneOriginalRef }).original;
  if (!original?.id) return null;
  return {
    id: original.id,
    type: String(original.type || ''),
    ...(original.projectId ? { projectId: original.projectId } : {}),
    ...(original.projectName ? { projectName: original.projectName } : {}),
    ...(original.domainId ? { domainId: original.domainId } : {}),
    ...(original.domainName ? { domainName: original.domainName } : {}),
  };
}

function findLocalOriginalBlock(
  model: FlatC4Model | null | undefined,
  original: Pick<CloneOriginalRef, 'id' | 'type'>
): BlockLike | null {
  if (!model) return null;
  const type = original.type;
  if (type === 'system') {
    return (
      ((model.systems || []) as BlockLike[]).find((s) => s.id === original.id && !s.original) ??
      null
    );
  }
  if (type === 'container') {
    return (
      ((model.containers || []) as BlockLike[]).find((c) => c.id === original.id && !c.original) ??
      null
    );
  }
  return null;
}

/** Hierarchy path for a local original (mirrors SDK useClonePath). */
export function formatCloneHierarchyPath(
  model: FlatC4Model | null | undefined,
  original: Pick<CloneOriginalRef, 'id' | 'type'>
): string | null {
  if (!model) return null;
  const { id, type } = original;
  switch (type) {
    case 'system':
      return null;
    case 'container': {
      const container = (model.containers || []).find((c) => c.id === id);
      if (!container) return null;
      const system = (model.systems || []).find((s) => s.id === container.systemId);
      return system ? `${system.name} / ${container.name}` : container.name;
    }
    case 'component': {
      const component = (model.components || []).find((c) => c.id === id);
      if (!component) return null;
      const container = (model.containers || []).find((c) => c.id === component.containerId);
      const system = container
        ? (model.systems || []).find((s) => s.id === container.systemId)
        : null;
      if (system && container) return `${system.name} / ${container.name} / ${component.name}`;
      if (container) return `${container.name} / ${component.name}`;
      return component.name;
    }
    case 'code': {
      const code = (model.codeElements || []).find((c) => c.id === id);
      if (!code) return null;
      const component = (model.components || []).find((c) => c.id === code.componentId);
      const container = component
        ? (model.containers || []).find((c) => c.id === component.containerId)
        : null;
      const system = container
        ? (model.systems || []).find((s) => s.id === container.systemId)
        : null;
      if (system && container && component) {
        return `${system.name} / ${container.name} / ${component.name} / ${code.name}`;
      }
      if (container && component) return `${container.name} / ${component.name} / ${code.name}`;
      if (component) return `${component.name} / ${code.name}`;
      return code.name;
    }
    default:
      return null;
  }
}

function formatRemoteHierarchyPath(
  element: Record<string, unknown>,
  original: Pick<CloneOriginalRef, 'id' | 'type'>
): string | null {
  const name = String(element.name || original.id);
  switch (original.type) {
    case 'system':
      return null;
    case 'container': {
      const systemName = String(element.systemName || '').trim();
      return systemName ? `${systemName} / ${name}` : name;
    }
    default:
      return name;
  }
}

function formatDomainOriginLabel(
  original: CloneOriginalRef,
  currentProjectId: string | undefined,
  t: (key: string, opts?: Record<string, string>) => string
): string | null {
  if (!original.domainName) return null;
  const remote = Boolean(original.projectId && original.projectId !== currentProjectId);
  if (remote && original.projectName) {
    return t('domain_remote_project', {
      project: original.projectName,
      domain: original.domainName,
    });
  }
  return original.domainName;
}

/** Label under a clone card: domain origin + optional hierarchy path. */
export function resolveCloneOriginLabel(
  item: unknown,
  model: FlatC4Model | null | undefined,
  currentProjectId: string | undefined,
  clonePath: string | null,
  remoteElement: Record<string, unknown> | null | undefined,
  remoteMeta: { domainName?: string; projectName?: string } | null | undefined,
  t: (key: string, opts?: Record<string, string>) => string
): string | null {
  const original = cloneOriginalRef(item);
  if (!original) return clonePath;

  let domainPart =
    formatDomainOriginLabel(original, currentProjectId, t) ??
    (remoteMeta?.domainName
      ? remoteMeta.projectName && original.projectId && original.projectId !== currentProjectId
        ? t('domain_remote_project', {
            project: remoteMeta.projectName,
            domain: remoteMeta.domainName,
          })
        : remoteMeta.domainName
      : null);

  if (!domainPart) {
    const local = findLocalOriginalBlock(model, original);
    const domain = local?.domainId ? findDomain(model, local.domainId) : null;
    if (domain) domainPart = domain.name;
  }

  const hierarchy =
    clonePath ||
    formatCloneHierarchyPath(model, original) ||
    (remoteElement ? formatRemoteHierarchyPath(remoteElement, original) : null);

  if (domainPart && hierarchy) return `${domainPart} · ${hierarchy}`;
  if (domainPart) return domainPart;
  return hierarchy;
}

export type DomainEdge = {
  fromDomainId: string;
  toDomainId: string;
};

/**
 * Derive domain-map edges from connections that cross a domain boundary:
 * onto a clone whose original lives in another domain, or directly onto
 * another original in a different domain of this project.
 */
export function deriveDomainEdges(
  model: FlatC4Model | null | undefined,
  opts?: {
    /** Resolve remote originals: elementId → domainId when known. */
    remoteDomainByElement?: Map<string, string>;
    currentProjectId?: string;
  }
): DomainEdge[] {
  if (!model) return [];
  const domains = getModelDomains(model);
  if (!domains.length) return [];

  const domainById = new Map(domains.map((d) => [d.id, d]));
  const elementDomain = new Map<string, string>();

  for (const s of (model.systems || []) as BlockLike[]) {
    if (s.domainId && domainById.has(s.domainId) && !s.original) {
      elementDomain.set(s.id, s.domainId);
    }
  }
  for (const c of (model.containers || []) as BlockLike[]) {
    if (c.domainId && domainById.has(c.domainId) && !c.original) {
      elementDomain.set(c.id, c.domainId);
    }
  }

  const remoteDomainByElement = opts?.remoteDomainByElement;
  const edgeKeys = new Set<string>();
  const edges: DomainEdge[] = [];

  const consider = (sourceId: string, target: BlockLike | undefined) => {
    if (!target?.id) return;
    const sourceDomainId = elementDomain.get(sourceId);
    if (!sourceDomainId) return;

    let targetDomainId: string | undefined;
    if (target.original?.id) {
      if (target.original.projectId && target.original.projectId !== opts?.currentProjectId) {
        targetDomainId = remoteDomainByElement?.get(
          `${target.original.projectId}:${target.original.id}`
        );
      } else {
        targetDomainId = elementDomain.get(target.original.id);
      }
    } else {
      targetDomainId = elementDomain.get(target.id);
    }
    if (!targetDomainId || targetDomainId === sourceDomainId) return;

    const sourceDomain = domainById.get(sourceDomainId);
    /* Remote domain level is unknown here — server validates same-level. */
    if (!sourceDomain) return;
    const targetDomain = domainById.get(targetDomainId);
    if (targetDomain && sourceDomain.level !== targetDomain.level) return;

    const key = `${sourceDomainId}->${targetDomainId}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ fromDomainId: sourceDomainId, toDomainId: targetDomainId });
  };

  const byId = new Map<string, BlockLike>();
  for (const s of (model.systems || []) as BlockLike[]) byId.set(s.id, s);
  for (const c of (model.containers || []) as BlockLike[]) byId.set(c.id, c);

  for (const list of [
    (model.systems || []) as BlockLike[],
    (model.containers || []) as BlockLike[],
  ]) {
    for (const src of list) {
      for (const conn of src.connections || []) {
        if (!conn?.targetId) continue;
        consider(src.id, byId.get(conn.targetId));
      }
    }
  }

  return edges;
}
