import type { Edge, Node } from '@xyflow/react';
import { isGroupFrameNodeId } from '@/types/c4Extensions';
import { CANVAS_NODE_WIDTH } from '@theme/canvasSurfaces';

export const DUCK_HOP_NODE_H = 140;

export type HopDirection = 'up' | 'down' | 'left' | 'right';

export function isPlayableHopNode(node: Node): boolean {
  return !isGroupFrameNodeId(node.id) && node.type !== 'thread';
}

export function nodeCenter(node: Node): { x: number; y: number } {
  const w = node.measured?.width ?? CANVAS_NODE_WIDTH;
  const h = node.measured?.height ?? DUCK_HOP_NODE_H;
  return {
    x: node.position.x + w / 2,
    y: node.position.y + h / 2,
  };
}

/** Flow coords for the duck perched on the node's top edge. */
export function nodeTopPerch(
  node: Node,
  position?: { x: number; y: number } | null
): { x: number; y: number } {
  const w = node.measured?.width ?? CANVAS_NODE_WIDTH;
  const pos = position ?? node.position;
  return {
    x: pos.x + w / 2,
    y: pos.y,
  };
}

export function canDrillIntoNode(
  node: Node,
  viewLevel: string
): boolean {
  if (!isPlayableHopNode(node)) return false;
  const type = (node.data as { type?: string }).type;
  if (viewLevel === 'system' && type === 'system') return true;
  if (viewLevel === 'container' && type === 'container') return true;
  if (viewLevel === 'component' && type === 'component') return true;
  return false;
}

export function canDrillUp(viewLevel: string): boolean {
  return viewLevel === 'container' || viewLevel === 'component' || viewLevel === 'code';
}

/** Node to perch on after Backspace navigates one level up. */
export function drillUpLandingId(model: {
  viewLevel: string;
  activeSystemId?: string | null;
  activeContainerId?: string | null;
  activeComponentId?: string | null;
}): string | null {
  if (model.viewLevel === 'code' && model.activeComponentId) {
    return model.activeComponentId;
  }
  if (model.viewLevel === 'component' && model.activeContainerId) {
    return model.activeContainerId;
  }
  if (model.viewLevel === 'container' && model.activeSystemId) {
    return model.activeSystemId;
  }
  return null;
}

export function pickStartHopNode(nodes: Node[], center: { x: number; y: number }): Node | null {
  const playable = nodes.filter(isPlayableHopNode);
  if (playable.length === 0) return null;

  let best = playable[0];
  let bestDist = Infinity;
  for (const node of playable) {
    const c = nodeCenter(node);
    const d = (c.x - center.x) ** 2 + (c.y - center.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

export function findHopNodeInDirection(
  nodes: Node[],
  current: Node,
  direction: HopDirection
): Node | null {
  const { x: cx, y: cy } = nodeCenter(current);
  let best: Node | null = null;
  let bestDist = Infinity;

  for (const node of nodes) {
    if (node.id === current.id || !isPlayableHopNode(node)) continue;
    const { x: nx, y: ny } = nodeCenter(node);
    const dx = nx - cx;
    const dy = ny - cy;

    const inDirection =
      direction === 'right'
        ? dx > 24 && Math.abs(dy) <= Math.abs(dx) * 1.35
        : direction === 'left'
          ? dx < -24 && Math.abs(dy) <= Math.abs(dx) * 1.35
          : direction === 'down'
            ? dy > 24 && Math.abs(dx) <= Math.abs(dy) * 1.35
            : dy < -24 && Math.abs(dx) <= Math.abs(dy) * 1.35;

    if (!inDirection) continue;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = node;
    }
  }

  return best;
}

export function findSpaceHopTarget(
  nodes: Node[],
  edges: Edge[],
  currentId: string,
  lastNeighborId: string | null
): Node | null {
  const playable = nodes.filter(isPlayableHopNode);
  const byId = new Map(playable.map((n) => [n.id, n]));
  const neighbors: Node[] = [];

  for (const edge of edges) {
    if (edge.source === currentId && byId.has(edge.target)) {
      neighbors.push(byId.get(edge.target)!);
    } else if (edge.target === currentId && byId.has(edge.source)) {
      neighbors.push(byId.get(edge.source)!);
    }
  }

  const unique = [...new Map(neighbors.map((n) => [n.id, n])).values()];
  if (unique.length > 0) {
    if (!lastNeighborId) return unique[0];
    const idx = unique.findIndex((n) => n.id === lastNeighborId);
    return unique[(idx + 1) % unique.length];
  }

  const others = playable.filter((n) => n.id !== currentId);
  if (others.length === 0) return null;
  return others[Math.floor(Math.random() * others.length)];
}
