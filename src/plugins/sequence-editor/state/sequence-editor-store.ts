import { create } from 'zustand';
import {
  applySequenceCommand,
  type SequenceCommand,
} from '../domain/commands';
import {
  emptySequenceModel,
  type SequenceModel,
} from '../domain/sequence-model';
import type { Diagnostic } from '../plantuml/diagnostics';
import { parsePlantUmlSequence } from '../plantuml/parser';
import { serializePlantUmlSequence } from '../plantuml/serializer';

export type UpdateOrigin = 'code' | 'canvas' | 'inspector' | 'import';

export type Selection =
  | { kind: 'participant'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'expand'; id: string }
  | null;

type HistoryEntry = {
  model: SequenceModel;
  source: string;
};

export interface SequenceEditorState {
  model: SequenceModel;
  source: string;
  lastValidSource: string;
  diagnostics: Diagnostic[];
  updateOrigin?: UpdateOrigin;
  revision: number;
  selection: Selection;
  strictParticipants: boolean;
  allowedParticipantIds: string[] | null;
  readOnly: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** UI-only: collapsed expand/group fragment ids */
  collapsedExpandIds: string[];
  init: (opts: {
    source?: string;
    model?: SequenceModel;
    strictParticipants?: boolean;
    allowedParticipantIds?: string[];
    readOnly?: boolean;
  }) => void;
  setAllowedParticipantIds: (ids: string[] | null) => void;
  setSourceFromEditor: (source: string) => void;
  applyCommand: (command: SequenceCommand, origin: UpdateOrigin) => void;
  setSelection: (selection: Selection) => void;
  toggleExpandCollapsed: (fragmentId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 100;

function pushHistory(past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...past, entry];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

export const useSequenceEditorStore = create<SequenceEditorState>((set, get) => ({
  model: emptySequenceModel(),
  source: serializePlantUmlSequence(emptySequenceModel()),
  lastValidSource: serializePlantUmlSequence(emptySequenceModel()),
  diagnostics: [],
  revision: 0,
  selection: null,
  strictParticipants: false,
  allowedParticipantIds: null,
  readOnly: false,
  past: [],
  future: [],
  collapsedExpandIds: [],

  init: ({
    source,
    model,
    strictParticipants = false,
    allowedParticipantIds,
    readOnly = false,
  }) => {
    let nextModel = model ?? emptySequenceModel();
    let nextSource = source ?? serializePlantUmlSequence(nextModel);
    let diagnostics: Diagnostic[] = [];
    const allowed = allowedParticipantIds ?? null;

    if (source != null) {
      const parsed = parsePlantUmlSequence(source, {
        strictParticipants,
        allowedParticipantIds: allowed ?? undefined,
      });
      diagnostics = parsed.diagnostics;
      if (parsed.ok) {
        nextModel = parsed.model;
        nextSource = serializePlantUmlSequence(parsed.model);
      } else {
        nextSource = source;
        nextModel = model ?? emptySequenceModel();
      }
    }

    set({
      model: nextModel,
      source: nextSource,
      lastValidSource: serializePlantUmlSequence(nextModel),
      diagnostics,
      revision: 1,
      updateOrigin: 'import',
      selection: null,
      strictParticipants,
      allowedParticipantIds: allowed,
      readOnly,
      past: [],
      future: [],
      collapsedExpandIds: [],
    });
  },

  setAllowedParticipantIds: (ids) => {
    const prev = get().allowedParticipantIds;
    if (prev === ids) return;
    if (
      prev &&
      ids &&
      prev.length === ids.length &&
      prev.every((id, i) => id === ids[i])
    ) {
      return;
    }
    set({ allowedParticipantIds: ids });
  },

  setSourceFromEditor: (source) => {
    if (get().readOnly) return;
    const { strictParticipants, allowedParticipantIds, model, lastValidSource, revision } = get();
    const parsed = parsePlantUmlSequence(source, {
      strictParticipants,
      allowedParticipantIds: allowedParticipantIds ?? undefined,
    });
    if (parsed.ok) {
      set({
        source: serializePlantUmlSequence(parsed.model),
        lastValidSource: serializePlantUmlSequence(parsed.model),
        model: parsed.model,
        diagnostics: parsed.diagnostics,
        updateOrigin: 'code',
        revision: revision + 1,
        past: pushHistory(get().past, { model, source: lastValidSource }),
        future: [],
      });
    } else {
      set({
        source,
        diagnostics: parsed.diagnostics,
        updateOrigin: 'code',
        revision: revision + 1,
      });
    }
  },

  applyCommand: (command, origin) => {
    if (get().readOnly) return;
    const { model, lastValidSource, revision } = get();
    try {
      const { model: next } = applySequenceCommand(model, command);
      const source = serializePlantUmlSequence(next);
      set({
        model: next,
        source,
        lastValidSource: source,
        diagnostics: [],
        updateOrigin: origin,
        revision: revision + 1,
        past: pushHistory(get().past, { model, source: lastValidSource }),
        future: [],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Command failed';
      set({
        diagnostics: [
          {
            severity: 'error',
            message,
            line: 1,
            column: 1,
            code: 'command_error',
          },
        ],
      });
    }
  },

  setSelection: (selection) => {
    const prev = get().selection;
    if (prev === null && selection === null) return;
    if (
      prev &&
      selection &&
      prev.kind === selection.kind &&
      prev.id === selection.id
    ) {
      return;
    }
    set({ selection });
  },

  toggleExpandCollapsed: (fragmentId) => {
    const cur = get().collapsedExpandIds;
    const has = cur.includes(fragmentId);
    set({
      collapsedExpandIds: has
        ? cur.filter((id) => id !== fragmentId)
        : [...cur, fragmentId],
    });
  },

  undo: () => {
    const { past, model, lastValidSource, future, revision } = get();
    if (!past.length) return;
    const prev = past[past.length - 1]!;
    set({
      past: past.slice(0, -1),
      future: [...future, { model, source: lastValidSource }],
      model: prev.model,
      source: prev.source,
      lastValidSource: prev.source,
      diagnostics: [],
      updateOrigin: 'canvas',
      revision: revision + 1,
    });
  },

  redo: () => {
    const { future, model, lastValidSource, past, revision } = get();
    if (!future.length) return;
    const next = future[future.length - 1]!;
    set({
      future: future.slice(0, -1),
      past: pushHistory(past, { model, source: lastValidSource }),
      model: next.model,
      source: next.source,
      lastValidSource: next.source,
      diagnostics: [],
      updateOrigin: 'canvas',
      revision: revision + 1,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
