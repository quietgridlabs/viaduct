import type { FlatC4Model, ViewLevel } from '@archivisio/c4-modelizer-sdk';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { getElementGroup, isPersonEntity } from '@/types/c4Extensions';
import { isPersonTechnology } from '@data/technologies';
import { LAYOUT, layoutSiblings, type LayoutPosition } from './layoutSiblings';
import { routeArrangedEdges, routeKey, type RouteNode } from './edgeHandles';

type ArrangeElement = {
  id: string;
  group?: string;
  position?: LayoutPosition;
  person?: boolean;
};

type ArrangeConnection = {
  sourceId: string;
  targetId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type ArrangeOutcome = {
  moved: number;
  /** The diagram this happened on — see `viewKeyOf`. */
  viewKey: string;
  /** Put every card and every line back exactly where they were. */
  revert: () => void;
};

/**
 * Which diagram is on screen: the level plus whatever it is a diagram *of*.
 *
 * Shared so the offer to undo an arrange and the check that it still applies
 * cannot drift apart — an undo held against one key and tested against another
 * would either never expire or expire on sight.
 */
export function viewKeyOf(model: {
  viewLevel: string;
  activeSystemId?: string | null;
  activeContainerId?: string | null;
  activeComponentId?: string | null;
}): string {
  return [
    model.viewLevel,
    model.activeSystemId || '',
    model.activeContainerId || '',
    model.activeComponentId || '',
  ].join('|');
}

/**
 * Rearrange every card on the current canvas view by its connections.
 * Returns what happened, or null when there was nothing to arrange.
 */
export function arrangeCurrentView(): ArrangeOutcome | null {
  const {
    model,
    updateSystem,
    updateContainer,
    updateComponent,
    updateCodeElement,
    updateConnection,
  } = useFlatC4Store.getState();
  const level = model.viewLevel;
  const { elements, connections } = siblingsOfView(model);
  if (!elements.length) return null;

  const updaters = {
    updateSystem,
    updateContainer,
    updateComponent,
    updateCodeElement,
  };
  /* Read the whole previous state before touching any of it — the updaters
     write straight into the store, so a snapshot taken halfway through would
     already be half the new layout. */
  const previous = snapshot(elements, connections);

  const positions = layoutSiblings(elements, connections);
  const moved = applyPositions(level, positions, updaters);
  rerouteConnections(level, elements, connections, positions, updateConnection);

  return {
    moved,
    viewKey: viewKeyOf(model),
    revert: () => {
      applyPositions(level, previous.positions, updaters);
      for (const [key, handles] of previous.handles) {
        const [sourceId, targetId] = key.split('\u0000');
        updateConnection(level, sourceId, targetId, handles);
      }
    },
  };
}

/** Where everything sat, and which faces every line used, before arranging. */
function snapshot(elements: ArrangeElement[], connections: ArrangeConnection[]) {
  const positions = new Map<string, LayoutPosition>();
  for (const el of elements) {
    if (el.position) positions.set(el.id, { ...el.position });
  }
  const handles = new Map<string, { sourceHandle: string; targetHandle: string }>();
  for (const { sourceId, targetId, sourceHandle, targetHandle } of connections) {
    handles.set(routeKey(sourceId, targetId), {
      /* Empty rather than absent: a connection drawn before handles were
         stored has none, and putting it back has to mean "none" too. */
      sourceHandle: sourceHandle || '',
      targetHandle: targetHandle || '',
    });
  }
  return { positions, handles };
}

/**
 * Point every line at the side the card it is going to now sits on.
 *
 * A connection stores the handles it was drawn against, and nothing has ever
 * revisited them. Arranging moved the cards underneath: an edge drawn when its
 * target was to the left still leaves from the left handle after the target
 * has been laid out to the right, so it exits the wrong face and loops back
 * across the card it came from. The layout was doing its half of the job and
 * the diagram still came out worse, which is what made the button not worth
 * pressing.
 */
function rerouteConnections(
  level: ViewLevel,
  elements: ArrangeElement[],
  connections: ArrangeConnection[],
  positions: Map<string, LayoutPosition>,
  updateConnection: (
    level: ViewLevel,
    sourceId: string,
    targetId: string,
    patch: { sourceHandle: string; targetHandle: string }
  ) => void
) {
  /* Compare centres, not corners: the layout places by top-left and every card
     on a level is the same nominal box, so the two only agree while that box
     stays square. */
  const nodes = new Map<string, RouteNode>();
  for (const el of elements) {
    const at = positions.get(el.id);
    if (!at) continue;
    nodes.set(el.id, {
      x: at.x + LAYOUT.nodeW / 2,
      y: at.y + LAYOUT.nodeH / 2,
      person: el.person,
    });
  }

  const routed = routeArrangedEdges(nodes, connections);
  for (const { sourceId, targetId } of connections) {
    const handles = routed.get(routeKey(sourceId, targetId));
    if (handles) updateConnection(level, sourceId, targetId, handles);
  }
}

type SiblingElement = {
  id: string;
  group?: string;
  kind?: string;
  technology?: string;
  position?: LayoutPosition;
  connections?: Array<{
    targetId?: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
};

function siblingsOfView(model: FlatC4Model) {
  const level = model.viewLevel;
  let list: SiblingElement[] = [];
  if (level === 'system') list = model.systems || [];
  else if (level === 'container') {
    list = (model.containers || []).filter((c) => c.systemId === model.activeSystemId);
  } else if (level === 'component') {
    list = (model.components || []).filter((c) => c.containerId === model.activeContainerId);
  } else {
    list = (model.codeElements || []).filter((c) => c.componentId === model.activeComponentId);
  }

  const elements: ArrangeElement[] = list.map((el) => ({
    id: el.id,
    group: getElementGroup(el),
    position: el.position,
    /* Same test the card itself makes: an actor is drawn under a glyph and
       carries one attachment point per side, so the suffixed handle ids the
       spreader would otherwise hand it do not exist. */
    person: isPersonEntity(el) || isPersonTechnology(el.technology),
  }));
  const idSet = new Set(elements.map((el) => el.id));
  const connections: ArrangeConnection[] = [];
  for (const el of list) {
    for (const conn of el.connections || []) {
      if (conn?.targetId && idSet.has(conn.targetId)) {
        connections.push({
          sourceId: el.id,
          targetId: conn.targetId,
          sourceHandle: conn.sourceHandle,
          targetHandle: conn.targetHandle,
        });
      }
    }
  }
  return { elements, connections };
}

function applyPositions(
  level: ViewLevel,
  positions: Map<string, LayoutPosition>,
  updaters: {
    updateSystem: (id: string, data: { position: LayoutPosition }) => void;
    updateContainer: (id: string, data: { position: LayoutPosition }) => void;
    updateComponent: (id: string, data: { position: LayoutPosition }) => void;
    updateCodeElement: (id: string, data: { position: LayoutPosition }) => void;
  }
) {
  let moved = 0;
  for (const [id, position] of positions) {
    if (level === 'system') updaters.updateSystem(id, { position });
    else if (level === 'container') updaters.updateContainer(id, { position });
    else if (level === 'component') updaters.updateComponent(id, { position });
    else updaters.updateCodeElement(id, { position });
    moved += 1;
  }
  return moved;
}
