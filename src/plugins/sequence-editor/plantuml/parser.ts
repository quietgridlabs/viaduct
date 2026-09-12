import {
  createId,
  emptySequenceModel,
  type ActivationItem,
  type ArrowType,
  type DividerItem,
  type FragmentItem,
  type MessageItem,
  type NoteItem,
  type Participant,
  type ParticipantKind,
  type SequenceItem,
  type SequenceModel,
} from '../domain/sequence-model';
import { normalizeSequenceModel } from '../domain/normalize';
import { diagnostic, type Diagnostic } from './diagnostics';
import { lexPlantUml, type Token } from './lexer';

export type ParseResult =
  | { ok: true; model: SequenceModel; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

export type ParseOptions = {
  strictParticipants?: boolean;
  /** When set with strictParticipants, only these aliases may be declared/used. */
  allowedParticipantIds?: string[];
};

const PARTICIPANT_KINDS = new Set<string>([
  'actor',
  'participant',
  'boundary',
  'control',
  'entity',
  'database',
  'queue',
  'collections',
]);

const SKIP_UNSUPPORTED = new Set([
  'break',
  'critical',
  'ref',
  'create',
  'destroy',
  'autonumber',
]);

const FRAGMENT_KINDS = new Set(['group', 'expand', 'alt', 'opt', 'loop', 'par']);
/* Both take more than one branch. They spell the separator differently:
   `alt` divides with `else`, `par` with `and`. */
const MULTI_BRANCH_KINDS = new Set(['alt', 'par']);
const BRANCH_SEPARATORS = new Set(['else', 'and']);

function parseDividerText(raw: string): string {
  // "== Label ==" or "==Label=="
  const m = raw.match(/^==\s*(.*?)\s*==\s*$/);
  if (m) return (m[1] ?? '').trim();
  return raw.replace(/^==\s*/, '').replace(/\s*==\s*$/, '').trim();
}

function parseDelayText(raw: string): string {
  return raw.replace(/^\.\.\.\s*/, '').replace(/\s*\.\.\.\s*$/, '').trim();
}

export function parsePlantUmlSequence(
  source: string,
  options: ParseOptions = {}
): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const tokens = lexPlantUml(source);
  let i = 0;

  const peek = () => tokens[i]!;
  const at = (kind: Token['kind'], value?: string) => {
    const t = peek();
    return t.kind === kind && (value === undefined || t.value.toLowerCase() === value.toLowerCase());
  };
  const consume = () => tokens[i++]!;
  const skipNewlines = () => {
    while (at('newline') || at('comment')) consume();
  };
  const restOfLineText = () => {
    const parts: string[] = [];
    while (!at('newline') && !at('eof') && !at('at_enduml')) {
      const t = consume();
      if (t.kind === 'comment') break;
      if (
        t.kind === 'string' ||
        t.kind === 'identifier' ||
        t.kind === 'keyword' ||
        t.kind === 'text'
      ) {
        parts.push(t.value);
      }
    }
    return parts.join(' ').trim();
  };
  const skipLine = () => {
    while (!at('newline') && !at('eof') && !at('at_enduml')) consume();
  };

  skipNewlines();
  if (!at('at_startuml')) {
    diagnostics.push(
      diagnostic('error', 'Expected @startuml', peek().line, peek().column, 'missing_startuml')
    );
    return { ok: false, diagnostics };
  }
  consume();
  skipNewlines();

  const model = emptySequenceModel();
  const participantsById = new Map<string, Participant>();
  let order = 0;
  let sawEnd = false;
  let hardError = false;
  let lastMessage: MessageItem | null = null;

  const ensureParticipant = (
    id: string,
    label: string,
    kind: ParticipantKind,
    line: number,
    column: number,
    implicit: boolean
  ) => {
    if (participantsById.has(id)) return participantsById.get(id)!;
    if (options.strictParticipants && implicit) {
      diagnostics.push(
        diagnostic(
          'error',
          `Unknown participant "${id}". Declare it explicitly or pick from C4 catalog.`,
          line,
          column,
          'unknown_participant'
        )
      );
      hardError = true;
      return null;
    }
    if (implicit) {
      diagnostics.push(
        diagnostic(
          'warning',
          `Implicit participant "${id}" created from message reference.`,
          line,
          column,
          'implicit_participant'
        )
      );
    }
    const p: Participant = { id, label, kind, order: order++ };
    participantsById.set(id, p);
    model.participants.push(p);
    return p;
  };

  const tryParseMessage = (): MessageItem | null => {
    if (
      !(
        at('identifier') ||
        (at('keyword') &&
          !SKIP_UNSUPPORTED.has(peek().value.toLowerCase()) &&
          !FRAGMENT_KINDS.has(peek().value.toLowerCase()) &&
          peek().value.toLowerCase() !== 'end' &&
          !BRANCH_SEPARATORS.has(peek().value.toLowerCase()) &&
          peek().value.toLowerCase() !== 'title' &&
          peek().value.toLowerCase() !== 'note' &&
          peek().value.toLowerCase() !== 'return' &&
          peek().value.toLowerCase() !== 'activate' &&
          peek().value.toLowerCase() !== 'deactivate' &&
          !PARTICIPANT_KINDS.has(peek().value.toLowerCase()))
      )
    ) {
      return null;
    }
    const fromTok = consume();
    if (!at('arrow')) {
      diagnostics.push(
        diagnostic(
          'warning',
          `Unsupported or unrecognized construct starting with "${fromTok.value}" (line kept in source-only mode).`,
          fromTok.line,
          fromTok.column,
          'unsupported_line'
        )
      );
      skipLine();
      return null;
    }
    const arrowTok = consume();
    if (!(at('identifier') || at('keyword'))) {
      diagnostics.push(
        diagnostic(
          'error',
          'Expected message target participant',
          arrowTok.line,
          arrowTok.endColumn,
          'bad_message'
        )
      );
      hardError = true;
      skipLine();
      return null;
    }
    const toTok = consume();

    let activate: MessageItem['activate'];
    let deactivate: MessageItem['deactivate'];
    while (at('plus_plus') || at('minus_minus')) {
      if (at('plus_plus')) {
        consume();
        activate = 'target';
      } else {
        consume();
        deactivate = 'target';
      }
    }

    let text = '';
    if (at('colon')) {
      consume();
      if (at('text') || at('string') || at('identifier') || at('keyword')) {
        text = consume().value;
        while (
          !at('newline') &&
          !at('eof') &&
          !at('at_enduml') &&
          (at('text') || at('string') || at('identifier') || at('keyword') || at('comma'))
        ) {
          text += ` ${consume().value}`;
        }
      }
    }

    const from = ensureParticipant(
      fromTok.value,
      fromTok.value,
      'participant',
      fromTok.line,
      fromTok.column,
      true
    );
    const to = ensureParticipant(
      toTok.value,
      toTok.value,
      'participant',
      toTok.line,
      toTok.column,
      true
    );
    skipLine();
    if (!from || !to) return null;
    const msg: MessageItem = {
      id: createId('msg'),
      type: 'message',
      from: from.id,
      to: to.id,
      text: text.trim(),
      arrow: arrowTok.value as ArrowType,
      ...(activate ? { activate } : {}),
      ...(deactivate ? { deactivate } : {}),
    };
    lastMessage = msg;
    return msg;
  };

  const tryParseNote = (): NoteItem | null => {
    if (!at('keyword', 'note')) return null;
    const start = consume();
    let position: NoteItem['position'] = 'over';
    const participantIds: string[] = [];

    if (at('keyword', 'over')) {
      consume();
      position = 'over';
      while (at('identifier') || at('keyword')) {
        const pTok = consume();
        const p = ensureParticipant(
          pTok.value,
          pTok.value,
          'participant',
          pTok.line,
          pTok.column,
          true
        );
        if (p) participantIds.push(p.id);
        if (at('comma')) {
          consume();
          continue;
        }
        break;
      }
    } else if (at('keyword', 'left') || at('keyword', 'right')) {
      position = peek().value.toLowerCase() as 'left' | 'right';
      consume();
      if (at('keyword', 'of')) consume();
      if (at('identifier') || at('keyword')) {
        const pTok = consume();
        const p = ensureParticipant(
          pTok.value,
          pTok.value,
          'participant',
          pTok.line,
          pTok.column,
          true
        );
        if (p) participantIds.push(p.id);
      }
    } else {
      diagnostics.push(
        diagnostic(
          'warning',
          `Malformed note on line ${start.line}`,
          start.line,
          start.column,
          'bad_note'
        )
      );
      skipLine();
      return null;
    }

    let text = '';
    if (at('colon')) {
      consume();
      if (at('text') || at('string') || at('identifier') || at('keyword')) {
        text = consume().value;
      }
    } else {
      // multiline note until `end note` — capture remaining as best-effort single line
      text = restOfLineText();
      skipNewlines();
      if (at('keyword', 'end')) {
        consume();
        if (at('keyword', 'note')) consume();
        skipLine();
      }
    }
    skipLine();

    if (!participantIds.length) {
      diagnostics.push(
        diagnostic(
          'warning',
          `Note on line ${start.line} has no participant — skipped`,
          start.line,
          start.column,
          'bad_note'
        )
      );
      return null;
    }

    return {
      id: createId('note'),
      type: 'note',
      position,
      participantIds: participantIds.slice(0, 2),
      text: text.trim() || 'note',
    };
  };

  const tryParseReturn = (): MessageItem | null => {
    if (!at('keyword', 'return')) return null;
    const start = consume();
    const text = restOfLineText();
    if (!lastMessage) {
      diagnostics.push(
        diagnostic(
          'warning',
          `\`return\` on line ${start.line} has no preceding message — skipped`,
          start.line,
          start.column,
          'orphan_return'
        )
      );
      return null;
    }
    const msg: MessageItem = {
      id: createId('msg'),
      type: 'message',
      from: lastMessage.to,
      to: lastMessage.from,
      text: text || 'return',
      arrow: '-->',
      return: true,
    };
    lastMessage = msg;
    return msg;
  };

  const tryParseActivation = (): ActivationItem | null => {
    if (!(at('keyword', 'activate') || at('keyword', 'deactivate'))) return null;
    const actionTok = consume();
    const action = actionTok.value.toLowerCase() as 'activate' | 'deactivate';
    if (!(at('identifier') || at('keyword'))) {
      diagnostics.push(
        diagnostic(
          'warning',
          `Expected participant after ${action}`,
          actionTok.line,
          actionTok.endColumn,
          'bad_activation'
        )
      );
      skipLine();
      return null;
    }
    const pTok = consume();
    const p = ensureParticipant(
      pTok.value,
      pTok.value,
      'participant',
      pTok.line,
      pTok.column,
      true
    );
    skipLine();
    if (!p) return null;
    return {
      id: createId('act'),
      type: 'activation',
      participantId: p.id,
      action,
    };
  };

  const tryParseDivider = (): DividerItem | null => {
    if (!(at('text') && peek().value.startsWith('=='))) return null;
    const t = consume();
    skipLine();
    return {
      id: createId('div'),
      type: 'divider',
      text: parseDividerText(t.value) || 'section',
    };
  };

  const tryParseDelay = (): SequenceItem | null => {
    if (!(at('text') && peek().value.startsWith('...'))) return null;
    const t = consume();
    skipLine();
    return {
      id: createId('delay'),
      type: 'delay',
      text: parseDelayText(t.value) || '',
    };
  };

  const parseFragmentBody = (allowElse: boolean): SequenceItem[] | FragmentItem['branches'] => {
    type BranchAcc = { id: string; condition?: string; items: SequenceItem[] };
    const branches: BranchAcc[] = [{ id: createId('br'), items: [] }];
    let current = branches[0]!;

    const pushParsed = (item: SequenceItem | null) => {
      if (item) current.items.push(item);
    };

    while (!at('eof') && !at('at_enduml')) {
      skipNewlines();
      if (at('eof') || at('at_enduml')) break;
      if (at('keyword', 'end')) {
        consume();
        skipLine();
        return allowElse ? branches : branches[0]!.items;
      }
      if (allowElse && at('keyword') && BRANCH_SEPARATORS.has(peek().value.toLowerCase())) {
        consume();
        const condition = restOfLineText() || undefined;
        current = { id: createId('br'), condition, items: [] };
        branches.push(current);
        continue;
      }
      if (at('keyword') && FRAGMENT_KINDS.has(peek().value.toLowerCase())) {
        const nested = parseFragment();
        pushParsed(nested);
        continue;
      }
      const note = tryParseNote();
      if (note) {
        pushParsed(note);
        continue;
      }
      const ret = tryParseReturn();
      if (ret) {
        pushParsed(ret);
        continue;
      }
      const act = tryParseActivation();
      if (act) {
        pushParsed(act);
        continue;
      }
      const div = tryParseDivider();
      if (div) {
        pushParsed(div);
        continue;
      }
      const delay = tryParseDelay();
      if (delay) {
        pushParsed(delay);
        continue;
      }
      const msg = tryParseMessage();
      if (msg) {
        pushParsed(msg);
        continue;
      }
      const t = peek();
      diagnostics.push(
        diagnostic(
          'warning',
          `Unsupported construct inside fragment on line ${t.line}.`,
          t.line,
          t.column,
          'unsupported_in_expand'
        )
      );
      skipLine();
    }
    diagnostics.push(
      diagnostic(
        'warning',
        'Missing `end` for fragment',
        peek().line,
        peek().column,
        'missing_end'
      )
    );
    return allowElse ? branches : branches[0]!.items;
  };

  const parseFragment = (): FragmentItem | null => {
    if (!(at('keyword') && FRAGMENT_KINDS.has(peek().value.toLowerCase()))) return null;
    const kw = consume().value.toLowerCase();
    const kind =
      kw === 'expand' ? 'group' : (kw as 'group' | 'alt' | 'opt' | 'loop' | 'par');
    const header = restOfLineText();
    const allowElse = MULTI_BRANCH_KINDS.has(kind);
    const body = parseFragmentBody(allowElse);

    if (allowElse) {
      const branches = body as FragmentItem['branches'];
      if (branches[0] && header) {
        branches[0] = { ...branches[0], condition: header };
      }
      return {
        id: createId('frag'),
        type: 'fragment',
        kind,
        label: header || kind,
        branches: branches.length ? branches : [{ id: createId('br'), items: [] }],
      };
    }

    const items = body as SequenceItem[];
    return {
      id: createId(kind === 'group' ? 'expand' : 'frag'),
      type: 'fragment',
      kind,
      label: header || (kind === 'group' ? 'Expand' : kind),
      branches: [
        {
          id: createId('br'),
          condition: kind === 'loop' || kind === 'opt' ? header || undefined : undefined,
          items,
        },
      ],
    };
  };

  while (!at('eof')) {
    skipNewlines();
    if (at('eof')) break;

    if (at('at_enduml')) {
      consume();
      sawEnd = true;
      break;
    }

    if (at('keyword', 'title')) {
      consume();
      model.title = restOfLineText() || undefined;
      continue;
    }

    const kindTok = peek();
    if (kindTok.kind === 'keyword' && PARTICIPANT_KINDS.has(kindTok.value.toLowerCase())) {
      const kind = consume().value.toLowerCase() as ParticipantKind;
      let label = '';
      let id = '';
      const start = peek();

      if (at('string')) {
        label = consume().value;
        if (at('keyword', 'as')) {
          consume();
          if (at('identifier') || at('keyword')) {
            id = consume().value;
          }
        } else {
          id = label.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^([^A-Za-z_])/, '_$1');
        }
      } else if (at('identifier') || at('keyword')) {
        const name = consume().value;
        label = name;
        id = name;
        if (at('keyword', 'as')) {
          consume();
          if (at('identifier') || at('keyword')) {
            id = consume().value;
          }
        }
      } else {
        diagnostics.push(
          diagnostic('error', 'Expected participant name', start.line, start.column, 'bad_participant')
        );
        hardError = true;
        skipLine();
        continue;
      }

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) {
        diagnostics.push(
          diagnostic('error', `Invalid participant alias "${id}"`, start.line, start.column, 'bad_alias')
        );
        hardError = true;
        skipLine();
        continue;
      }

      if (
        options.strictParticipants &&
        options.allowedParticipantIds &&
        !options.allowedParticipantIds.includes(id)
      ) {
        diagnostics.push(
          diagnostic(
            'error',
            `Participant "${id}" is not in the C4 model for this diagram. Use autocomplete to pick a valid element.`,
            start.line,
            start.column,
            'not_in_c4_catalog'
          )
        );
        hardError = true;
        skipLine();
        continue;
      }

      if (participantsById.has(id)) {
        diagnostics.push(
          diagnostic(
            'warning',
            `Duplicate participant "${id}" ignored`,
            start.line,
            start.column,
            'dup_participant'
          )
        );
      } else {
        ensureParticipant(id, label || id, kind, start.line, start.column, false);
      }
      skipLine();
      continue;
    }

    if (at('keyword') && FRAGMENT_KINDS.has(peek().value.toLowerCase())) {
      const frag = parseFragment();
      if (frag) model.items.push(frag);
      continue;
    }

    const note = tryParseNote();
    if (note) {
      model.items.push(note);
      continue;
    }

    const ret = tryParseReturn();
    if (ret) {
      model.items.push(ret);
      continue;
    }

    const act = tryParseActivation();
    if (act) {
      model.items.push(act);
      continue;
    }

    const div = tryParseDivider();
    if (div) {
      model.items.push(div);
      continue;
    }

    const delay = tryParseDelay();
    if (delay) {
      model.items.push(delay);
      continue;
    }

    const msg = tryParseMessage();
    if (msg) {
      model.items.push(msg);
      continue;
    }

    if (at('keyword') && SKIP_UNSUPPORTED.has(peek().value.toLowerCase())) {
      const t = peek();
      const kw = t.value.toLowerCase();
      diagnostics.push(
        diagnostic(
          'warning',
          `Construct \`${t.value}\` on line ${t.line} is available only in code/preview mode for now.`,
          t.line,
          t.column,
          'unsupported_construct'
        )
      );
      skipLine();
      if (['par', 'break', 'critical', 'ref'].includes(kw)) {
        let depth = 1;
        while (!at('eof') && !at('at_enduml') && depth > 0) {
          skipNewlines();
          if (at('eof') || at('at_enduml')) break;
          if (at('keyword', 'end')) {
            depth--;
            skipLine();
            continue;
          }
          if (
            at('keyword') &&
            ['par', 'break', 'critical'].includes(peek().value.toLowerCase())
          ) {
            depth++;
          }
          skipLine();
        }
      }
      continue;
    }

    if (at('keyword', 'end')) {
      diagnostics.push(
        diagnostic(
          'warning',
          `Unexpected \`end\` on line ${peek().line}`,
          peek().line,
          peek().column,
          'unexpected_end'
        )
      );
      skipLine();
      continue;
    }

    const t = peek();
    diagnostics.push(
      diagnostic('error', `Unexpected token "${t.value}"`, t.line, t.column, 'unexpected_token')
    );
    hardError = true;
    skipLine();
  }

  if (!sawEnd) {
    diagnostics.push(
      diagnostic('warning', 'Missing @enduml', peek().line, peek().column, 'missing_enduml')
    );
  }

  if (hardError) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    model: normalizeSequenceModel(model),
    diagnostics,
  };
}
