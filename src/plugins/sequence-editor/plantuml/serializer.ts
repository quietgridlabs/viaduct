import type { Participant, SequenceItem, SequenceModel } from '../domain/sequence-model';
import { normalizeSequenceModel } from '../domain/normalize';

function needsQuotes(label: string, id: string): boolean {
  return label !== id || /\s/.test(label) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(label);
}

function formatParticipant(p: Participant): string {
  if (needsQuotes(p.label, p.id)) {
    return `${p.kind} "${p.label}" as ${p.id}`;
  }
  return `${p.kind} ${p.id}`;
}

function formatItem(item: SequenceItem, indent: string): string[] {
  if (item.type === 'message') {
    if (item.return) {
      return [`${indent}return ${item.text}`.trimEnd()];
    }
    const lines: string[] = [];
    if (item.activate === 'source') {
      lines.push(`${indent}activate ${item.from}`);
    }
    if (item.deactivate === 'source') {
      // deactivation of source usually after the message
    }
    const text = item.text ? `: ${item.text}` : '';
    let suffix = '';
    if (item.activate === 'target') suffix += '++';
    if (item.deactivate === 'target') suffix += '--';
    lines.push(`${indent}${item.from} ${item.arrow} ${item.to}${suffix}${text}`);
    if (item.deactivate === 'source') {
      lines.push(`${indent}deactivate ${item.from}`);
    }
    return lines;
  }
  if (item.type === 'note') {
    if (item.position === 'over') {
      return [`${indent}note over ${item.participantIds.join(',')}: ${item.text}`];
    }
    return [`${indent}note ${item.position} of ${item.participantIds[0]}: ${item.text}`];
  }
  if (item.type === 'delay') {
    return [`${indent}... ${item.text} ...`];
  }
  if (item.type === 'divider') {
    return [`${indent}== ${item.text} ==`];
  }
  if (item.type === 'activation') {
    return [`${indent}${item.action} ${item.participantId}`];
  }
  const lines: string[] = [];
  item.branches.forEach((branch, idx) => {
    const head =
      idx === 0
        ? `${indent}${item.kind}${branch.condition || item.label ? ` ${branch.condition ?? item.label}` : ''}`
        : `${indent}${item.kind === 'par' ? 'and' : 'else'}${branch.condition ? ` ${branch.condition}` : ''}`;
    lines.push(head.trimEnd());
    for (const child of branch.items) {
      lines.push(...formatItem(child, `${indent}  `));
    }
  });
  lines.push(`${indent}end`);
  return lines;
}

export function serializePlantUmlSequence(model: SequenceModel): string {
  const normalized = normalizeSequenceModel(model);
  const lines: string[] = ['@startuml'];

  if (normalized.title?.trim()) {
    lines.push(`title ${normalized.title.trim()}`);
  }

  for (const p of normalized.participants) {
    lines.push(formatParticipant(p));
  }

  if (normalized.participants.length && normalized.items.length) {
    lines.push('');
  }

  for (const item of normalized.items) {
    lines.push(...formatItem(item, ''));
  }

  lines.push('@enduml');
  return `${lines.join('\n')}\n`;
}
