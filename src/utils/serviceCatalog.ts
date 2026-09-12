import type {
  ComponentBlock,
  ContainerBlock,
  FlatC4Model,
  SystemBlock,
  ViewLevel,
} from '@archivisio/c4-modelizer-sdk';
import * as gatewaysJson from '@data/technologies/gateways.json';
import { isApiEndpoint, isExternalEntity } from '@/types/c4Extensions';
import { isBrokerTechnology } from './brokerTech';
import { isDatabaseTechnology, techIdsFromJson } from './databaseTech';

export type ServiceCategory = 'service' | 'database' | 'broker' | 'gateway';

export const SERVICE_CATEGORY_ORDER: ServiceCategory[] = [
  'service',
  'gateway',
  'broker',
  'database',
];

const GATEWAY_TECH_IDS = techIdsFromJson(gatewaysJson);

export function classifyContainer(container: {
  technology?: string | null;
}): ServiceCategory {
  if (isDatabaseTechnology(container.technology)) return 'database';
  if (isBrokerTechnology(container.technology)) return 'broker';
  if (container.technology && GATEWAY_TECH_IDS.has(container.technology)) return 'gateway';
  return 'service';
}

export type CatalogElementKind = 'system' | 'container' | 'component';

export type CatalogHit = {
  id: string;
  kind: CatalogElementKind;
  name: string;
  description?: string;
  technology?: string;
  systemId?: string;
  systemName?: string;
  containerId?: string;
  containerName?: string;
  external?: boolean;
  category?: ServiceCategory;
};

function isClone(item: { original?: unknown } | null | undefined): boolean {
  return Boolean(item && (item as { original?: unknown }).original);
}

export function listCatalogContainers(model: FlatC4Model): ContainerBlock[] {
  return model.containers.filter((c) => !isClone(c));
}

export function groupContainersBySystem(model: FlatC4Model): Array<{
  system: SystemBlock;
  categories: Array<{ category: ServiceCategory; containers: ContainerBlock[] }>;
}> {
  const systems = [...model.systems]
    .filter((s) => !isClone(s))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const bySystem = new Map<string, ContainerBlock[]>();
  for (const c of listCatalogContainers(model)) {
    const list = bySystem.get(c.systemId) ?? [];
    list.push(c);
    bySystem.set(c.systemId, list);
  }

  return systems
    .map((system) => {
      const containers = (bySystem.get(system.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      const buckets = new Map<ServiceCategory, ContainerBlock[]>();
      for (const c of containers) {
        const cat = classifyContainer(c);
        const list = buckets.get(cat) ?? [];
        list.push(c);
        buckets.set(cat, list);
      }
      const categories = SERVICE_CATEGORY_ORDER.filter((cat) => buckets.has(cat)).map((cat) => ({
        category: cat,
        containers: buckets.get(cat)!,
      }));
      return { system, categories };
    })
    .filter((g) => g.categories.length > 0);
}

export function searchCatalogElements(model: FlatC4Model, query: string): CatalogHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const systemName = (id?: string) => model.systems.find((s) => s.id === id)?.name;
  const containerName = (id?: string) => model.containers.find((c) => c.id === id)?.name;
  const hits: CatalogHit[] = [];

  for (const s of model.systems) {
    if (isClone(s)) continue;
    if (!s.name.toLowerCase().includes(q)) continue;
    hits.push({
      id: s.id,
      kind: 'system',
      name: s.name,
      description: s.description,
      technology: s.technology,
      systemId: s.id,
      systemName: s.name,
      external: isExternalEntity(s),
    });
  }

  for (const c of listCatalogContainers(model)) {
    if (!c.name.toLowerCase().includes(q)) continue;
    hits.push({
      id: c.id,
      kind: 'container',
      name: c.name,
      description: c.description,
      technology: c.technology,
      systemId: c.systemId,
      systemName: systemName(c.systemId),
      containerId: c.id,
      containerName: c.name,
      external: isExternalEntity(c),
      category: classifyContainer(c),
    });
  }

  for (const c of model.components) {
    if (isClone(c)) continue;
    if (!c.name.toLowerCase().includes(q) && !(c as ComponentBlock & { endpoint?: string }).endpoint?.toLowerCase().includes(q)) {
      continue;
    }
    hits.push({
      id: c.id,
      kind: 'component',
      name: c.name,
      description: c.description,
      technology: c.technology,
      systemId: c.systemId,
      systemName: systemName(c.systemId),
      containerId: c.containerId,
      containerName: containerName(c.containerId),
      external: isExternalEntity(c),
    });
  }

  return hits.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function catalogHitById(model: FlatC4Model, id: string): CatalogHit | null {
  const systemName = (sid?: string) => model.systems.find((s) => s.id === sid)?.name;
  const containerName = (cid?: string) => model.containers.find((c) => c.id === cid)?.name;

  const system = model.systems.find((s) => s.id === id);
  if (system && !isClone(system)) {
    return {
      id: system.id,
      kind: 'system',
      name: system.name,
      description: system.description,
      technology: system.technology,
      systemId: system.id,
      systemName: system.name,
      external: isExternalEntity(system),
    };
  }

  const container = listCatalogContainers(model).find((c) => c.id === id);
  if (container) {
    return {
      id: container.id,
      kind: 'container',
      name: container.name,
      description: container.description,
      technology: container.technology,
      systemId: container.systemId,
      systemName: systemName(container.systemId),
      containerId: container.id,
      containerName: container.name,
      external: isExternalEntity(container),
      category: classifyContainer(container),
    };
  }

  const component = model.components.find((c) => c.id === id);
  if (component && !isClone(component)) {
    return {
      id: component.id,
      kind: 'component',
      name: component.name,
      description: component.description,
      technology: component.technology,
      systemId: component.systemId,
      systemName: systemName(component.systemId),
      containerId: component.containerId,
      containerName: containerName(component.containerId),
      external: isExternalEntity(component),
    };
  }

  return null;
}

export type DiagramFocusTarget = {
  id: string;
  viewLevel: ViewLevel;
  activeSystemId?: string;
  activeContainerId?: string;
  activeComponentId?: string;
};

export function resolveDiagramFocus(
  model: FlatC4Model,
  id: string
): DiagramFocusTarget | null {
  const system = model.systems.find((s) => s.id === id);
  if (system) return { id, viewLevel: 'system' };

  const container = model.containers.find((c) => c.id === id);
  if (container) {
    return {
      id,
      viewLevel: 'container',
      activeSystemId: container.systemId,
    };
  }

  const component = model.components.find((c) => c.id === id);
  if (component) {
    return {
      id,
      viewLevel: 'component',
      activeSystemId: component.systemId,
      activeContainerId: component.containerId,
    };
  }

  const code = model.codeElements.find((c) => c.id === id);
  if (code) {
    const parent = model.components.find((c) => c.id === code.componentId);
    return {
      id,
      viewLevel: 'code',
      activeSystemId: parent?.systemId,
      activeContainerId: parent?.containerId,
      activeComponentId: code.componentId,
    };
  }

  return null;
}

/**
 * The deepest level these ids can actually draw something at.
 *
 * Every level below the widest one is a view *into* a parent: containers are
 * the containers of one system, components those of one container. Asked for
 * `container` with no system, the board filters its containers against nothing
 * and comes back empty — a blank canvas that a reload silently fixes, because
 * the URL only ever spells out a level it has the ids for.
 *
 * Callers that name a domain or a project rather than an element have no ids to
 * give, so the request is clamped to the widest level that renders.
 */
export function renderableViewLevel(view: {
  viewLevel: ViewLevel;
  activeSystemId?: string;
  activeContainerId?: string;
  activeComponentId?: string;
}): ViewLevel {
  const { viewLevel, activeSystemId, activeContainerId, activeComponentId } = view;
  if (viewLevel === 'system') return 'system';
  if (!activeSystemId) return 'system';
  if (viewLevel === 'container') return 'container';
  if (!activeContainerId) return 'container';
  if (viewLevel === 'component') return 'component';
  if (!activeComponentId) return 'component';
  return 'code';
}

export function diagramFocusMatchesView(
  model: FlatC4Model,
  target: DiagramFocusTarget
): boolean {
  if (model.viewLevel !== target.viewLevel) return false;
  if (target.viewLevel === 'system') return true;
  if (target.viewLevel === 'container') {
    return model.activeSystemId === target.activeSystemId;
  }
  if (target.viewLevel === 'component') {
    return model.activeContainerId === target.activeContainerId;
  }
  return (
    model.activeSystemId === target.activeSystemId &&
    model.activeContainerId === target.activeContainerId &&
    model.activeComponentId === target.activeComponentId
  );
}

export function catalogEditorPath(
  projectId: string | undefined,
  focusId: string,
  returnTo?: string | null
): string {
  const params = new URLSearchParams();
  params.set('focus', focusId);
  if (returnTo) params.set('returnTo', returnTo);
  const q = params.toString();
  return projectId ? `/projects/${projectId}?${q}` : `/?${q}`;
}

export function listContainerEndpoints(
  model: FlatC4Model,
  containerId: string
): ComponentBlock[] {
  return model.components.filter(
    (c) => c.containerId === containerId && !isClone(c) && isApiEndpoint(c as ComponentBlock & { kind?: string; endpoint?: string })
  );
}
