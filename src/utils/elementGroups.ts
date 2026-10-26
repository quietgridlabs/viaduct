import { getElementGroup, GROUP_NODE_PREFIX, isGroupFrameNodeId } from '@/types/c4Extensions';
import { CANVAS_NODE_WIDTH } from '@theme/canvasSurfaces';
import type { Node, XYPosition } from '@xyflow/react';

const FALLBACK_W = CANVAS_NODE_WIDTH;
const FALLBACK_H = 128;
const TABLE_W = 300;
const PAD_X = 22;
const PAD_TOP = 40;
const PAD_BOTTOM = 28;

function nodeSize(node: Node): { w: number; h: number } {
  const measured = node.measured;
  if (measured?.width && measured?.height) {
    return { w: measured.width, h: measured.height };
  }
  if (typeof node.width === 'number' && typeof node.height === 'number') {
    return { w: node.width, h: node.height };
  }
  if (node.type === 'table') return { w: TABLE_W, h: FALLBACK_H };
  return { w: FALLBACK_W, h: FALLBACK_H };
}

/** Visual-only RF nodes that wrap elements sharing a `group` name. */
export function buildGroupFrameNodes(nodes: Node[]): Node[] {
  const buckets = new Map<string, { label: string; members: Node[] }>();
  for (const node of nodes) {
    if (isGroupFrameNodeId(node.id)) continue;
    const label = getElementGroup(node.data);
    if (!label) continue;
    const key = label.toLowerCase();
    const bucket = buckets.get(key);
    if (bucket) bucket.members.push(node);
    else buckets.set(key, { label, members: [node] });
  }

  const frames: Node[] = [];
  for (const [key, { label, members }] of buckets) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of members) {
      const { w, h } = nodeSize(node);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }
    if (!Number.isFinite(minX)) continue;
    const width = Math.max(120, maxX - minX + PAD_X * 2);
    const height = Math.max(80, maxY - minY + PAD_TOP + PAD_BOTTOM);
    frames.push({
      id: `${GROUP_NODE_PREFIX}${key}`,
      type: 'groupFrame',
      position: { x: minX - PAD_X, y: minY - PAD_TOP },
      width,
      height,
      style: { width, height, pointerEvents: 'none', background: 'transparent', border: 'none' },
      /* Draggable by its title only (`dragHandle`), so the body stays canvas:
         a click or a marquee inside the frame still reaches the board. */
      className: 'nopan',
      dragHandle: '.group-frame-handle',
      data: {
        label,
        memberCount: members.length,
        /* "Group" is what this is on the level diagram, where a frame gathers
           elements sharing a group tag. Round a service graph's orbs it is a
           system, and calling that a group tells the reader something untrue. */
        caption: members.some((m) => m.type === 'serviceOrb') ? '' : undefined,
      },
      selectable: false,
      connectable: false,
      focusable: false,
      deletable: false,
      zIndex: -1,
    });
  }
  return frames;
}

/**
 * Where the members land when their frame is put at `position`. The frame has
 * no position of its own — it is derived from its members — so moving it means
 * moving every member by the same delta.
 */
export function moveGroupFrame(
  frameId: string,
  position: XYPosition,
  nodes: Node[]
): { id: string; position: XYPosition }[] {
  const frame = buildGroupFrameNodes(nodes).find((f) => f.id === frameId);
  if (!frame) return [];
  const dx = position.x - frame.position.x;
  const dy = position.y - frame.position.y;
  const key = frameId.slice(GROUP_NODE_PREFIX.length);
  return nodes
    .filter((n) => !isGroupFrameNodeId(n.id) && getElementGroup(n.data).toLowerCase() === key)
    .map((n) => ({ id: n.id, position: { x: n.position.x + dx, y: n.position.y + dy } }));
}
