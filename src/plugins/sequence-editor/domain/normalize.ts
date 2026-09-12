import type { Participant, SequenceItem, SequenceModel } from './sequence-model';

export function normalizeParticipantOrders(participants: Participant[]): Participant[] {
  return [...participants]
    .sort((a, b) => a.order - b.order)
    .map((p, index) => ({ ...p, order: index }));
}

export function normalizeSequenceModel(model: SequenceModel): SequenceModel {
  return {
    ...model,
    version: 1,
    participants: normalizeParticipantOrders(model.participants),
    items: model.items.map(normalizeItem),
  };
}

function normalizeItem(item: SequenceItem): SequenceItem {
  if (item.type !== 'fragment') return item;
  return {
    ...item,
    branches: item.branches.map((b) => ({
      ...b,
      items: b.items.map(normalizeItem),
    })),
  };
}

export function slugifyParticipantId(raw: string, fallbackPrefix = 'P'): string {
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^[^A-Za-z_]+/, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleaned)) return cleaned;
  const digits = raw.replace(/[^A-Za-z0-9]/g, '');
  return `${fallbackPrefix}_${digits || Math.random().toString(36).slice(2, 8)}`;
}
