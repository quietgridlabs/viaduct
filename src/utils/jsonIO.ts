import { C4Model, FlatC4Model, useFlatC4Store } from '@archivisio/c4-modelizer-sdk';

export const CURRENT_SCHEMA_VERSION = 2;

export type ExportScope = 'full' | 'current';

type WithConnections = {
  id: string;
  connections?: { targetId: string }[];
};

function filterEntityConnections<T extends WithConnections>(
  entities: T[],
  allowedIds: Set<string>
): T[] {
  return entities.map((e) => ({
    ...e,
    connections: (e.connections || []).filter((c) => allowedIds.has(c.targetId)),
  }));
}

/**
 * Slice the flat model to what is visible on the current diagram level,
 * keeping ancestor entities so the file remains a valid importable model.
 */
export function sliceModelForCurrentView(model: FlatC4Model): FlatC4Model {
  const {
    viewLevel,
    activeSystemId,
    activeContainerId,
    activeComponentId,
    systems,
    containers,
    components,
    codeElements,
  } = model;

  if (viewLevel === 'system') {
    const ids = new Set(systems.map((s) => s.id));
    return {
      ...model,
      systems: filterEntityConnections(systems, ids),
      containers: [],
      components: [],
      codeElements: [],
    };
  }

  if (viewLevel === 'container') {
    if (!activeSystemId) return { ...model };
    const sys = systems.filter((s) => s.id === activeSystemId);
    const conts = containers.filter((c) => c.systemId === activeSystemId);
    const ids = new Set([...sys, ...conts].map((e) => e.id));
    return {
      ...model,
      systems: filterEntityConnections(sys, ids),
      containers: filterEntityConnections(conts, ids),
      components: [],
      codeElements: [],
    };
  }

  if (viewLevel === 'component') {
    if (!activeSystemId || !activeContainerId) return { ...model };
    const sys = systems.filter((s) => s.id === activeSystemId);
    const conts = containers.filter((c) => c.id === activeContainerId);
    const comps = components.filter((c) => c.containerId === activeContainerId);
    const ids = new Set([...sys, ...conts, ...comps].map((e) => e.id));
    return {
      ...model,
      systems: filterEntityConnections(sys, ids),
      containers: filterEntityConnections(conts, ids),
      components: filterEntityConnections(comps, ids),
      codeElements: [],
    };
  }

  // code level
  if (!activeSystemId || !activeContainerId || !activeComponentId) return { ...model };
  const sys = systems.filter((s) => s.id === activeSystemId);
  const conts = containers.filter((c) => c.id === activeContainerId);
  const comps = components.filter((c) => c.id === activeComponentId);
  const codes = codeElements.filter((c) => c.componentId === activeComponentId);
  const ids = new Set([...sys, ...conts, ...comps, ...codes].map((e) => e.id));
  return {
    ...model,
    systems: filterEntityConnections(sys, ids),
    containers: filterEntityConnections(conts, ids),
    components: filterEntityConnections(comps, ids),
    codeElements: filterEntityConnections(codes, ids),
  };
}

export function exportModel(scope: ExportScope = 'full'): string {
  const store = useFlatC4Store.getState();
  const source = scope === 'current' ? sliceModelForCurrentView(store.model) : store.model;
  const modelWithVersion = {
    ...source,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  return JSON.stringify(modelWithVersion, null, 2);
}

export function importModel(json: string): boolean {
  try {
    const obj = JSON.parse(json);
    if (obj && Array.isArray(obj.systems)) {
      const store = useFlatC4Store.getState();

      // Version 2 (Flat structure)
      if (typeof obj.schemaVersion === "number" && obj.schemaVersion === CURRENT_SCHEMA_VERSION &&
        Array.isArray(obj.containers) &&
        Array.isArray(obj.components) &&
        Array.isArray(obj.codeElements)) {
        store.setModel(obj as FlatC4Model);
        return true;
      }
      // Version 1 (Nested structure) - Automatic conversion
      else if (typeof obj.schemaVersion === "number" && obj.schemaVersion === 1) {
        const flatModel = convertToFlatModel(obj as C4Model);
        store.setModel(flatModel);
        return true;
      } else {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export const convertToFlatModel = (nestedModel: C4Model): FlatC4Model => {
  const flatModel: FlatC4Model = {
    systems: [],
    containers: [],
    components: [],
    codeElements: [],
    viewLevel: nestedModel.viewLevel || 'system',
    activeSystemId: nestedModel.activeSystemId,
    activeContainerId: nestedModel.activeContainerId,
    activeComponentId: nestedModel.activeComponentId,
  };

  nestedModel.systems.forEach(system => {
    flatModel.systems.push({
      ...system,
      connections: [...system.connections],
    });
    if (system.containers) {
      system.containers.forEach(container => {
        flatModel.containers.push({
          ...container,
          connections: [...container.connections],
        });

        if (container.components) {
          container.components.forEach(component => {
            flatModel.components.push({
              ...component,
              connections: [...component.connections],
            });

            if (component.codeElements) {
              component.codeElements.forEach(codeElement => {
                flatModel.codeElements.push({
                  ...codeElement,
                  connections: [...codeElement.connections],
                });
              });
            }
          });
        }
      });
    }
  });

  return flatModel;
};
