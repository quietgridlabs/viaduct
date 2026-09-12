import type { Edge, Node } from '@xyflow/react';
import type {
  ActivationItem,
  DelayItem,
  DividerItem,
  FragmentItem,
  FragmentKind,
  MessageItem,
  NoteItem,
  SequenceItem,
  SequenceModel,
} from '../domain/sequence-model';
import { collectMessages, isCollapsibleFragment } from '../domain/itemsTree';
import {
  DEFAULT_LAYOUT,
  eventY,
  laneX,
  type SequenceLayoutConfig,
} from '../layout/sequence-layout';
import type { DividerNodeData } from './DividerNode';
import type { NoteNodeData } from './NoteNode';

export type ParticipantNodeData = {
  label: string;
  kind: string;
  participantId: string;
  order: number;
};

export type MessageEdgeData = {
  text: string;
  arrow: string;
  itemId: string;
  eventIndex: number;
  y?: number;
  fromOrder?: number;
  toOrder?: number;
  isReturn?: boolean;
};

export type ExpandNodeData = {
  fragmentId: string;
  label: string;
  kind: FragmentKind;
  collapsed: boolean;
  messageCount: number;
  width: number;
  height: number;
  /**
   * Who owns the collapsed state. The editor leaves this out and the frame
   * talks to the editor store; a preview renders the same diagram outside that
   * store and passes its own toggle instead.
   */
  onToggle?: (fragmentId: string) => void;
};

export type ActivationBarData = {
  participantId: string;
  order: number;
  top: number;
  height: number;
};

type FlatRow =
  | {
      kind: 'fragment';
      fragment: FragmentItem;
      collapsed: true;
      messages: MessageItem[];
    }
  | {
      kind: 'fragmentOpen';
      fragment: FragmentItem;
      messages: MessageItem[];
    }
  | { kind: 'fragmentClose'; fragmentId: string }
  | { kind: 'branchSep'; fragmentId: string; text: string }
  | { kind: 'message'; item: MessageItem }
  | { kind: 'note'; item: NoteItem }
  | { kind: 'divider'; item: DividerItem }
  | { kind: 'delay'; item: DelayItem }
  | { kind: 'activation'; item: ActivationItem };

function flattenItems(
  items: SequenceItem[],
  collapsedIds: ReadonlySet<string>
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const item of items) {
    if (item.type === 'message') {
      rows.push({ kind: 'message', item });
      continue;
    }
    if (item.type === 'note') {
      rows.push({ kind: 'note', item });
      continue;
    }
    if (item.type === 'divider') {
      rows.push({ kind: 'divider', item });
      continue;
    }
    if (item.type === 'delay') {
      rows.push({ kind: 'delay', item });
      continue;
    }
    if (item.type === 'activation') {
      rows.push({ kind: 'activation', item });
      continue;
    }
    if (isCollapsibleFragment(item)) {
      const messages = collectMessages(item.branches.flatMap((b) => b.items));
      const collapsed = collapsedIds.has(item.id);
      if (collapsed) {
        rows.push({ kind: 'fragment', fragment: item, collapsed: true, messages });
      } else {
        rows.push({ kind: 'fragmentOpen', fragment: item, messages });
        item.branches.forEach((branch, idx) => {
          if (idx > 0) {
            rows.push({
              kind: 'branchSep',
              fragmentId: item.id,
              text: branch.condition ? `else ${branch.condition}` : 'else',
            });
          }
          rows.push(...flattenItems(branch.items, collapsedIds));
        });
        rows.push({ kind: 'fragmentClose', fragmentId: item.id });
      }
    }
  }
  return rows;
}

function fragmentFrameLabel(fragment: FragmentItem): string {
  if (fragment.kind === 'alt' || fragment.kind === 'opt' || fragment.kind === 'loop') {
    const text = (fragment.label || fragment.branches[0]?.condition || '').trim();
    if (!text) return fragment.kind;
    const lower = text.toLowerCase();
    if (lower === fragment.kind || lower.startsWith(`${fragment.kind} `)) return text;
    return `${fragment.kind} ${text}`;
  }
  return fragment.label || 'Expand';
}

function applyActivationSideEffects(
  stacks: Map<string, number[]>,
  intervals: ActivationBarData[],
  participantId: string,
  order: number,
  action: 'activate' | 'deactivate',
  eventIndex: number,
  config: SequenceLayoutConfig
) {
  const stack = stacks.get(participantId) ?? [];
  if (action === 'activate') {
    stack.push(eventIndex);
    stacks.set(participantId, stack);
    return;
  }
  const start = stack.pop();
  stacks.set(participantId, stack);
  if (start == null) return;
  const top = eventY(start, config) - 8;
  const bottom = eventY(eventIndex, config) + 8;
  intervals.push({
    participantId,
    order,
    top,
    height: Math.max(bottom - top, 20),
  });
}

export function projectToReactFlow(
  model: SequenceModel,
  config: SequenceLayoutConfig = DEFAULT_LAYOUT,
  collapsedExpandIds: ReadonlySet<string> = new Set()
): {
  nodes: Node[];
  edges: Edge[];
  height: number;
  width: number;
  activationBars: ActivationBarData[];
} {
  const participants = [...model.participants].sort((a, b) => a.order - b.order);
  const orderById = new Map(participants.map((p) => [p.id, p.order]));
  const rows = flattenItems(model.items, collapsedExpandIds);

  const width =
    config.firstLaneX + Math.max(participants.length, 1) * config.laneWidth + 80;
  const frameLeft = Math.max(24, config.firstLaneX - 100);
  const frameWidth = Math.max(width - frameLeft - 40, 280);

  const nodes: Node[] = participants.map((p) => ({
    id: `participant:${p.id}`,
    type: 'sequenceParticipant',
    position: { x: laneX(p.order, config) - 80, y: config.headerY },
    data: {
      label: p.label,
      kind: p.kind,
      participantId: p.id,
      order: p.order,
    } satisfies ParticipantNodeData,
    draggable: true,
    style: { width: 160 },
  }));

  const edges: Edge[] = [];
  const activationBars: ActivationBarData[] = [];
  const activationStacks = new Map<string, number[]>();
  let eventIndex = 0;
  const openFrames = new Map<
    string,
    { fragment: FragmentItem; startRow: number; messageCount: number }
  >();

  const closeOpenActivations = (atIndex: number) => {
    for (const [pid, stack] of activationStacks) {
      while (stack.length) {
        const start = stack.pop()!;
        const order = orderById.get(pid) ?? 0;
        const top = eventY(start, config) - 8;
        const bottom = eventY(Math.max(atIndex, start), config) + 40;
        activationBars.push({
          participantId: pid,
          order,
          top,
          height: Math.max(bottom - top, 20),
        });
      }
    }
  };

  const emitFrameNode = (
    fragment: FragmentItem,
    startRow: number,
    endY: number,
    collapsed: boolean,
    messageCount: number
  ) => {
    const top = eventY(startRow, config) - 28;
    const height = collapsed ? 44 : Math.max(endY - top + 36, 56);
    nodes.push({
      id: `expand:${fragment.id}`,
      type: 'sequenceExpand',
      position: { x: frameLeft, y: top },
      data: {
        fragmentId: fragment.id,
        label: fragmentFrameLabel(fragment),
        kind: fragment.kind,
        collapsed,
        messageCount,
        width: frameWidth,
        height,
      } satisfies ExpandNodeData,
      draggable: false,
      selectable: true,
      zIndex: 0,
      style: {
        width: frameWidth,
        height,
        pointerEvents: collapsed ? 'all' : 'none',
      },
    });
  };

  rows.forEach((row) => {
    const y = eventY(eventIndex, config);

    if (row.kind === 'fragment') {
      openFrames.set(row.fragment.id, {
        fragment: row.fragment,
        startRow: eventIndex,
        messageCount: row.messages.length,
      });
      emitFrameNode(row.fragment, eventIndex, y, true, row.messages.length);
      openFrames.delete(row.fragment.id);
      eventIndex += 1;
      return;
    }

    if (row.kind === 'fragmentOpen') {
      openFrames.set(row.fragment.id, {
        fragment: row.fragment,
        startRow: eventIndex,
        messageCount: row.messages.length,
      });
      eventIndex += 1;
      return;
    }

    if (row.kind === 'fragmentClose') {
      const frame = openFrames.get(row.fragmentId);
      if (frame) {
        const endY = eventY(Math.max(eventIndex - 1, frame.startRow), config);
        emitFrameNode(
          frame.fragment,
          frame.startRow,
          endY,
          false,
          frame.messageCount
        );
        openFrames.delete(row.fragmentId);
      }
      return;
    }

    if (row.kind === 'branchSep') {
      nodes.push({
        id: `branch:${row.fragmentId}:${eventIndex}`,
        type: 'sequenceDivider',
        position: { x: frameLeft, y: y - 14 },
        data: {
          dividerId: `branch:${row.fragmentId}:${eventIndex}`,
          text: row.text,
          width: frameWidth,
          kind: 'branch',
        } satisfies DividerNodeData,
        draggable: false,
        selectable: false,
        zIndex: 1,
        style: { width: frameWidth, pointerEvents: 'none' },
      });
      eventIndex += 1;
      return;
    }

    if (row.kind === 'activation') {
      const order = orderById.get(row.item.participantId) ?? 0;
      applyActivationSideEffects(
        activationStacks,
        activationBars,
        row.item.participantId,
        order,
        row.item.action,
        eventIndex,
        config
      );
      return;
    }

    if (row.kind === 'note') {
      const ids = row.item.participantIds;
      const orders = ids
        .map((id) => orderById.get(id))
        .filter((o): o is number => o != null);
      if (!orders.length) {
        eventIndex += 1;
        return;
      }
      const minO = Math.min(...orders);
      const maxO = Math.max(...orders);
      const left = laneX(minO, config) - 70;
      const right = laneX(maxO, config) + 70;
      let x = left;
      let w = Math.max(right - left, 140);
      if (row.item.position === 'left') {
        x = laneX(minO, config) - 180;
        w = 150;
      } else if (row.item.position === 'right') {
        x = laneX(maxO, config) + 30;
        w = 150;
      }
      const h = Math.max(36, 20 + Math.ceil(row.item.text.length / 28) * 14);
      nodes.push({
        id: `note:${row.item.id}`,
        type: 'sequenceNote',
        position: { x, y: y - h / 2 },
        data: {
          noteId: row.item.id,
          text: row.item.text,
          position: row.item.position,
          width: w,
          height: h,
        } satisfies NoteNodeData,
        draggable: false,
        selectable: true,
        zIndex: 3,
        style: { width: w, pointerEvents: 'all' },
      });
      eventIndex += 1;
      return;
    }

    if (row.kind === 'divider' || row.kind === 'delay') {
      nodes.push({
        id: `${row.kind}:${row.item.id}`,
        type: 'sequenceDivider',
        position: { x: frameLeft, y: y - 14 },
        data: {
          dividerId: row.item.id,
          text: row.item.text,
          width: frameWidth,
          kind: row.kind,
        } satisfies DividerNodeData,
        draggable: false,
        selectable: true,
        zIndex: 2,
        style: { width: frameWidth, pointerEvents: 'all' },
      });
      eventIndex += 1;
      return;
    }

    // message
    const msg = row.item;
    const from = participants.find((p) => p.id === msg.from);
    const to = participants.find((p) => p.id === msg.to);

    if (msg.activate) {
      const pid = msg.activate === 'source' ? msg.from : msg.to;
      applyActivationSideEffects(
        activationStacks,
        activationBars,
        pid,
        orderById.get(pid) ?? 0,
        'activate',
        eventIndex,
        config
      );
    }

    edges.push({
      id: `message:${msg.id}`,
      type: 'sequenceMessage',
      source: `participant:${msg.from}`,
      target: `participant:${msg.to}`,
      data: {
        text: msg.text,
        arrow: msg.arrow,
        itemId: msg.id,
        eventIndex,
        y,
        fromOrder: from?.order ?? 0,
        toOrder: to?.order ?? 0,
        isReturn: Boolean(msg.return),
      },
      selectable: true,
      zIndex: 1,
    });

    if (msg.deactivate) {
      const pid = msg.deactivate === 'source' ? msg.from : msg.to;
      applyActivationSideEffects(
        activationStacks,
        activationBars,
        pid,
        orderById.get(pid) ?? 0,
        'deactivate',
        eventIndex,
        config
      );
    }

    eventIndex += 1;
  });

  if (eventIndex > 0) closeOpenActivations(eventIndex - 1);

  const height =
    eventIndex === 0
      ? config.eventStartY + config.bottomPadding
      : eventY(eventIndex - 1, config) + config.bottomPadding;

  return { nodes, edges, height, width, activationBars };
}
