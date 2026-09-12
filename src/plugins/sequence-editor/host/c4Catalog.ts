import { isDatabaseTechnology } from '@utils/databaseTech';
import { isCloneBlock } from '@utils/cloneSource';

export type C4ParticipantKindHint = 'system' | 'container' | 'component';

export type C4CatalogParticipant = {
  /** Stable PlantUML alias */
  id: string;
  label: string;
  /** UI group for the participant picker (Systems / Containers / Databases / parent name). */
  group: string;
  c4Type: C4ParticipantKindHint;
  c4EntityId: string;
  external?: boolean;
  /** Suggested PlantUML participant kind */
  plantUmlKind: 'actor' | 'participant' | 'boundary' | 'control' | 'entity' | 'database';
};

export function c4TypeToPlantUmlKind(
  c4Type: C4ParticipantKindHint,
  external?: boolean,
  opts?: { isDatabase?: boolean }
): C4CatalogParticipant['plantUmlKind'] {
  if (external) return 'actor';
  if (c4Type === 'system') return 'boundary';
  if (c4Type === 'container') {
    return opts?.isDatabase ? 'database' : 'participant';
  }
  return 'control';
}

export function catalogContainerGroup(technology?: string | null): 'Containers' | 'Databases' {
  return isDatabaseTechnology(technology) ? 'Databases' : 'Containers';
}

/** Preferred group order in participant / attach selects. */
export function sortCatalogGroups<T>(entries: [string, T[]][]): [string, T[]][] {
  const rank = (group: string) => {
    if (group === 'Systems') return 0;
    if (group === 'Containers') return 1;
    if (group === 'Databases') return 2;
    return 10;
  };
  return [...entries].sort(([a], [b]) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

export function slugFromC4(name: string, entityId: string): string {
  const fromName = name
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^[^A-Za-z_]+/, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(fromName)) return fromName;
  const fromId = `E_${entityId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'x'}`;
  return fromId;
}

type FlatLike = {
  systems: Array<{ id: string; name: string; external?: boolean }>;
  containers: Array<{
    id: string;
    name: string;
    systemId: string;
    technology?: string | null;
    external?: boolean;
  }>;
  components: Array<{
    id: string;
    name: string;
    containerId: string;
    systemId: string;
    external?: boolean;
  }>;
};

function pushCatalogItem(
  out: C4CatalogParticipant[],
  usedIds: Set<string>,
  c4Type: C4ParticipantKindHint,
  entity: { id: string; name: string; external?: boolean; technology?: string | null },
  group: string
) {
  let id = slugFromC4(entity.name, entity.id);
  let n = 2;
  while (usedIds.has(id)) {
    id = `${slugFromC4(entity.name, entity.id)}_${n++}`;
  }
  usedIds.add(id);
  const isDatabase = c4Type === 'container' && isDatabaseTechnology(entity.technology);
  out.push({
    id,
    label: entity.name,
    group,
    c4Type,
    c4EntityId: entity.id,
    external: entity.external,
    plantUmlKind: c4TypeToPlantUmlKind(c4Type, entity.external, { isDatabase }),
  });
}

export function buildC4Catalog(opts: {
  model: FlatLike;
  ownerType: 'container' | 'component';
  ownerId: string;
}): C4CatalogParticipant[] {
  const { model, ownerType, ownerId } = opts;
  const out: C4CatalogParticipant[] = [];
  const usedIds = new Set<string>();

  const push = (
    c4Type: C4ParticipantKindHint,
    entity: { id: string; name: string; external?: boolean; technology?: string | null },
    group: string
  ) => pushCatalogItem(out, usedIds, c4Type, entity, group);

  if (ownerType === 'container') {
    const container = model.containers.find((c) => c.id === ownerId);
    if (!container) return out;
    const system = model.systems.find((s) => s.id === container.systemId);
    if (system) push('system', system, 'Systems');
    const siblings = model.containers.filter((c) => c.systemId === container.systemId);
    for (const c of siblings.filter((c) => !isDatabaseTechnology(c.technology))) {
      push('container', c, 'Containers');
    }
    for (const c of siblings.filter((c) => isDatabaseTechnology(c.technology))) {
      push('container', c, 'Databases');
    }
    for (const comp of model.components.filter((c) => c.containerId === ownerId)) {
      push('component', comp, container.name);
    }
    return out;
  }

  const component = model.components.find((c) => c.id === ownerId);
  if (!component) return out;
  const container = model.containers.find((c) => c.id === component.containerId);
  const system = model.systems.find((s) => s.id === component.systemId);
  if (system) push('system', system, 'Systems');
  if (container) {
    push('container', container, catalogContainerGroup(container.technology));
  }
  for (const comp of model.components.filter((c) => c.containerId === component.containerId)) {
    push('component', comp, container?.name ?? 'Components');
  }
  return out;
}

/** Broader catalog for unbound drafts / picking participants freely. */
export function buildProjectC4Catalog(
  model: FlatLike,
  scope?: { systemId?: string; containerId?: string }
): C4CatalogParticipant[] {
  const out: C4CatalogParticipant[] = [];
  const usedIds = new Set<string>();

  const push = (
    c4Type: C4ParticipantKindHint,
    entity: { id: string; name: string; external?: boolean; technology?: string | null },
    group: string
  ) => pushCatalogItem(out, usedIds, c4Type, entity, group);

  /* A clone card is the same real thing as its original — offering both would
     put two lifelines on the diagram for one component. */
  const systems = (
    scope?.systemId ? model.systems.filter((s) => s.id === scope.systemId) : model.systems
  ).filter((s) => !isCloneBlock(s));
  for (const s of systems) push('system', s, 'Systems');

  const containers = model.containers.filter((c) => {
    if (isCloneBlock(c)) return false;
    if (scope?.containerId) return c.id === scope.containerId;
    if (scope?.systemId) return c.systemId === scope.systemId;
    return true;
  });
  for (const c of containers.filter((c) => !isDatabaseTechnology(c.technology))) {
    push('container', c, 'Containers');
  }
  for (const c of containers.filter((c) => isDatabaseTechnology(c.technology))) {
    push('container', c, 'Databases');
  }

  const containerName = new Map(containers.map((c) => [c.id, c.name]));
  const components = model.components.filter((c) => {
    if (isCloneBlock(c)) return false;
    if (scope?.containerId) return c.containerId === scope.containerId;
    if (scope?.systemId) return c.systemId === scope.systemId;
    return true;
  });
  for (const c of components) {
    push('component', c, containerName.get(c.containerId) ?? 'Components');
  }

  return out;
}
