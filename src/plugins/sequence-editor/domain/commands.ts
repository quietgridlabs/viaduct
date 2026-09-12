import type {
  Participant,
  SequenceItem,
  SequenceModel,
} from './sequence-model';
import { normalizeSequenceModel } from './normalize';
import { validateSequenceModel } from './sequence-schema';
import {
  findItemDeep,
  removeItemDeep,
  unwrapExpand,
  updateItemDeep,
  wrapMessagesInExpand,
} from './itemsTree';

export type SequenceCommand =
  | { type: 'participant.add'; participant: Participant }
  | { type: 'participant.update'; id: string; patch: Partial<Participant> }
  | { type: 'participant.reorder'; id: string; toOrder: number }
  | {
      type: 'participant.remove';
      id: string;
      strategy: 'block' | 'remove-references';
    }
  | { type: 'item.add'; index: number; item: SequenceItem }
  | { type: 'item.update'; id: string; patch: Partial<SequenceItem> }
  | { type: 'item.move'; fromIndex: number; toIndex: number }
  | { type: 'item.remove'; id: string }
  | { type: 'item.wrapExpand'; messageIds: string[]; label?: string }
  | { type: 'item.unwrapExpand'; fragmentId: string }
  | { type: 'source.replace'; source: string; model: SequenceModel }
  | { type: 'model.replace'; model: SequenceModel };

export type CommandResult = {
  model: SequenceModel;
  inverse: SequenceCommand;
};

function findItemIndex(items: SequenceItem[], id: string): number {
  return items.findIndex((i) => i.id === id);
}

export function applySequenceCommand(
  model: SequenceModel,
  command: SequenceCommand
): CommandResult {
  switch (command.type) {
    case 'model.replace':
    case 'source.replace': {
      const next = validateSequenceModel(normalizeSequenceModel(command.model));
      return {
        model: next,
        inverse: { type: 'model.replace', model },
      };
    }
    case 'participant.add': {
      const participants = normalizeSequenceModel({
        ...model,
        participants: [...model.participants, command.participant],
      }).participants;
      const next = validateSequenceModel({ ...model, participants });
      return {
        model: next,
        inverse: {
          type: 'participant.remove',
          id: command.participant.id,
          strategy: 'remove-references',
        },
      };
    }
    case 'participant.update': {
      const prev = model.participants.find((p) => p.id === command.id);
      if (!prev) throw new Error(`Participant ${command.id} not found`);
      const participants = model.participants.map((p) =>
        p.id === command.id ? { ...p, ...command.patch, id: p.id } : p
      );
      const next = validateSequenceModel(normalizeSequenceModel({ ...model, participants }));
      return {
        model: next,
        inverse: { type: 'participant.update', id: command.id, patch: prev },
      };
    }
    case 'participant.reorder': {
      const sorted = [...model.participants].sort((a, b) => a.order - b.order);
      const fromIndex = sorted.findIndex((p) => p.id === command.id);
      if (fromIndex < 0) throw new Error(`Participant ${command.id} not found`);
      const [moved] = sorted.splice(fromIndex, 1);
      const toOrder = Math.max(0, Math.min(command.toOrder, sorted.length));
      sorted.splice(toOrder, 0, moved!);
      const participants = sorted.map((p, order) => ({ ...p, order }));
      const next = validateSequenceModel({ ...model, participants });
      return {
        model: next,
        inverse: { type: 'participant.reorder', id: command.id, toOrder: fromIndex },
      };
    }
    case 'participant.remove': {
      const prev = model.participants.find((p) => p.id === command.id);
      if (!prev) throw new Error(`Participant ${command.id} not found`);
      const hasRefs = findNestedMessageRefs(model.items, command.id);
      if (command.strategy === 'block' && hasRefs) {
        throw new Error('Participant has message references');
      }
      const items =
        command.strategy === 'remove-references'
          ? removeMessagesReferencing(model.items, command.id)
          : model.items;
      const participants = model.participants.filter((p) => p.id !== command.id);
      const next = validateSequenceModel(
        normalizeSequenceModel({ ...model, participants, items })
      );
      return {
        model: next,
        inverse: { type: 'participant.add', participant: prev },
      };
    }
    case 'item.add': {
      const items = [...model.items];
      const index = Math.max(0, Math.min(command.index, items.length));
      items.splice(index, 0, command.item);
      const next = validateSequenceModel({ ...model, items });
      return {
        model: next,
        inverse: { type: 'item.remove', id: command.item.id },
      };
    }
    case 'item.update': {
      const prev = findItemDeep(model.items, command.id);
      if (!prev) throw new Error(`Item ${command.id} not found`);
      const items = updateItemDeep(model.items, command.id, command.patch);
      const next = validateSequenceModel({ ...model, items });
      return {
        model: next,
        inverse: { type: 'item.update', id: command.id, patch: prev },
      };
    }
    case 'item.move': {
      const items = [...model.items];
      const [moved] = items.splice(command.fromIndex, 1);
      if (!moved) throw new Error('Invalid fromIndex');
      const toIndex = Math.max(0, Math.min(command.toIndex, items.length));
      items.splice(toIndex, 0, moved);
      const next = validateSequenceModel({ ...model, items });
      return {
        model: next,
        inverse: { type: 'item.move', fromIndex: toIndex, toIndex: command.fromIndex },
      };
    }
    case 'item.remove': {
      const prev = findItemDeep(model.items, command.id);
      if (!prev) throw new Error(`Item ${command.id} not found`);
      const topIndex = findItemIndex(model.items, command.id);
      const items = removeItemDeep(model.items, command.id);
      const next = validateSequenceModel({ ...model, items });
      return {
        model: next,
        inverse:
          topIndex >= 0
            ? { type: 'item.add', index: topIndex, item: prev }
            : { type: 'model.replace', model },
      };
    }
    case 'item.wrapExpand': {
      const items = wrapMessagesInExpand(
        model.items,
        command.messageIds,
        command.label ?? 'Expand'
      );
      if (items === model.items) throw new Error('Could not wrap selection in expand');
      const next = validateSequenceModel({ ...model, items });
      const created = items.find(
        (it) =>
          it.type === 'fragment' &&
          it.kind === 'group' &&
          !model.items.some((x) => x.id === it.id)
      );
      return {
        model: next,
        inverse: created
          ? { type: 'item.unwrapExpand', fragmentId: created.id }
          : { type: 'model.replace', model },
      };
    }
    case 'item.unwrapExpand': {
      const prev = findItemDeep(model.items, command.fragmentId);
      if (!prev || prev.type !== 'fragment') throw new Error('Expand group not found');
      const items = unwrapExpand(model.items, command.fragmentId);
      const next = validateSequenceModel({ ...model, items });
      return {
        model: next,
        inverse: { type: 'model.replace', model },
      };
    }
    default: {
      const _exhaustive: never = command;
      throw new Error(`Unknown command ${(_exhaustive as SequenceCommand).type}`);
    }
  }
}

function findNestedMessageRefs(items: SequenceItem[], participantId: string): boolean {
  for (const it of items) {
    if (it.type === 'message' && (it.from === participantId || it.to === participantId)) {
      return true;
    }
    if (it.type === 'fragment') {
      for (const b of it.branches) {
        if (findNestedMessageRefs(b.items, participantId)) return true;
      }
    }
  }
  return false;
}

function removeMessagesReferencing(
  items: SequenceItem[],
  participantId: string
): SequenceItem[] {
  const out: SequenceItem[] = [];
  for (const it of items) {
    if (it.type === 'message') {
      if (it.from !== participantId && it.to !== participantId) out.push(it);
      continue;
    }
    if (it.type === 'note') {
      if (!it.participantIds.includes(participantId)) out.push(it);
      continue;
    }
    if (it.type === 'activation') {
      if (it.participantId !== participantId) out.push(it);
      continue;
    }
    if (it.type === 'fragment') {
      out.push({
        ...it,
        branches: it.branches.map((b) => ({
          ...b,
          items: removeMessagesReferencing(b.items, participantId),
        })),
      });
      continue;
    }
    out.push(it);
  }
  return out;
}
