export type ParticipantKind =
  | 'actor'
  | 'participant'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'database'
  | 'queue'
  | 'collections';

export type ArrowType = '->' | '-->' | '->>' | '-->>' | '->x' | '-->x';

export interface Participant {
  id: string;
  label: string;
  kind: ParticipantKind;
  order: number;
  color?: string;
  /** Original C4 entity id when added from catalog — used to prevent duplicates. */
  c4EntityId?: string;
}

export interface MessageItem {
  id: string;
  type: 'message';
  from: string;
  to: string;
  text: string;
  arrow: ArrowType;
  /** PlantUML `return` shorthand — serialize as `return text`. */
  return?: boolean;
  activate?: 'source' | 'target';
  deactivate?: 'source' | 'target';
}

export interface NoteItem {
  id: string;
  type: 'note';
  position: 'left' | 'right' | 'over';
  participantIds: string[];
  text: string;
}

export interface DelayItem {
  id: string;
  type: 'delay';
  text: string;
}

/** PlantUML `== Label ==` separator. */
export interface DividerItem {
  id: string;
  type: 'divider';
  text: string;
}

/** Standalone `activate X` / `deactivate X` (existence / activation bar). */
export interface ActivationItem {
  id: string;
  type: 'activation';
  participantId: string;
  action: 'activate' | 'deactivate';
}

export interface FragmentBranch {
  id: string;
  condition?: string;
  items: SequenceItem[];
}

export type FragmentKind =
  | 'alt'
  | 'opt'
  | 'loop'
  | 'par'
  | 'break'
  | 'critical'
  | 'group';

export interface FragmentItem {
  id: string;
  type: 'fragment';
  kind: FragmentKind;
  label: string;
  branches: FragmentBranch[];
}

export type SequenceItem =
  | MessageItem
  | NoteItem
  | DelayItem
  | DividerItem
  | ActivationItem
  | FragmentItem;

export interface SequenceModel {
  version: 1;
  title?: string;
  participants: Participant[];
  items: SequenceItem[];
}

export const PARTICIPANT_KINDS: ParticipantKind[] = [
  'actor',
  'participant',
  'boundary',
  'control',
  'entity',
  'database',
  'queue',
  'collections',
];

export const ARROW_TYPES: ArrowType[] = ['->', '-->', '->>', '-->>', '->x', '-->x'];

export function emptySequenceModel(title?: string): SequenceModel {
  return {
    version: 1,
    title,
    participants: [],
    items: [],
  };
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
