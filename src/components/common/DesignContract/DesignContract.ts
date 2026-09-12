/**
 * The design of a UI element, stored as one tagged string on the element.
 *
 *   @design https://figma.com/design/8Kd2/Weather?node-id=12-345
 *   @version 2026-09-06T09:12:00Z
 *
 *   @props
 *   plan: Plan!               # what is rendered
 *   selected: boolean = false
 *
 *   @state default
 *   @state loading            # skeleton, width must not jump
 *
 *   @tokens
 *   bg.dialog, border.strong
 *
 *   @a11y
 *   role=button · hit area at least 44px
 *
 * The picture is never in here: `@design` is a reference, read from the design
 * tool when the work is done. What this holds is what the design tool does not
 * — the states someone decided must exist, and the version the work was
 * pinned against. The format is the server's (`designContract.js`); this file
 * is the editor's half of the same agreement.
 */

export const DESIGN_TAG_RE = /^@(design|version|props|state|tokens|a11y|description|composes)\b/im;
const SECTION_RE = /^@(design|version|props|state|tokens|a11y|description|composes)\b(.*)$/i;
const URL_RE = /^https?:\/\/\S+$/i;
/** `system#12:345` — a node named against the container's design system. */
const REF_RE = /^[A-Za-z0-9._-]{1,64}#[A-Za-z0-9:;_-]{1,64}$/;

export type DesignState = {
  /** Runtime-only, for stable list keys. Never serialized. */
  id: string;
  name: string;
  note: string;
};

export type DesignProp = {
  id: string;
  name: string;
  type: string;
  required: boolean;
  default: string;
  description: string;
};

/**
 * One part a screen is built from. A name and, optionally, the slot it sits in
 * — the order of the list is reading order. Never coordinates: where things
 * sit in pixels is the node's business, and duplicating it here would be a
 * second source of truth that quietly rots.
 */
export type DesignComposeEntry = {
  id: string;
  slot: string;
  name: string;
};

export type DesignContract = {
  /** A link to the node, or `system#12:345`. */
  node: string;
  /** When the node was last read — what drift is measured against. */
  version: string;
  description: string;
  props: DesignProp[];
  states: DesignState[];
  tokens: string[];
  composes: DesignComposeEntry[];
  a11y: string;
};

export type DesignValidation = { ok: boolean; error?: string };

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * `system#12-345` as `system#12:345` — Figma's URL spelling folded into the
 * API's, so the node has one name however it was copied. A link is left as
 * Figma wrote it.
 */
export function canonicalDesignRef(value: string): string {
  const text = value.trim();
  if (!text || URL_RE.test(text)) return text;
  const at = text.indexOf('#');
  if (at <= 0) return text;
  return `${text.slice(0, at)}#${text.slice(at + 1).replace(/-/g, ':')}`;
}

export function isDesignRef(value: string): boolean {
  const ref = value.trim();
  return URL_RE.test(ref) || REF_RE.test(ref);
}

export function emptyDesignContract(): DesignContract {
  return {
    node: '',
    version: '',
    description: '',
    props: [],
    states: [],
    tokens: [],
    composes: [],
    a11y: '',
  };
}

export function newDesignComposeEntry(patch: Partial<DesignComposeEntry> = {}): DesignComposeEntry {
  return { id: uid('cmp'), slot: '', name: '', ...patch };
}

/** `slot: A, B` per line, or a bare list. */
export function parseComposition(body: string): DesignComposeEntry[] {
  const out: DesignComposeEntry[] = [];
  for (const line of (body || '').split('\n')) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const colon = text.indexOf(':');
    const slot = colon > 0 ? text.slice(0, colon).trim() : '';
    const names = (colon > 0 ? text.slice(colon + 1) : text)
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    for (const name of names) out.push(newDesignComposeEntry({ slot, name }));
  }
  return out;
}

/** Consecutive entries sharing a slot come back on one line, as written. */
export function serializeComposition(entries: DesignComposeEntry[]): string {
  const lines: string[] = [];
  let slot: string | null = null;
  let names: string[] = [];
  const flush = () => {
    if (!names.length) return;
    lines.push(slot ? `${slot}: ${names.join(', ')}` : names.join(', '));
    names = [];
  };
  for (const entry of entries) {
    if (!entry.name.trim()) continue;
    if (entry.slot !== slot) {
      flush();
      slot = entry.slot;
    }
    names.push(entry.name.trim());
  }
  flush();
  return lines.join('\n');
}

export function newDesignState(patch: Partial<DesignState> = {}): DesignState {
  return { id: uid('st'), name: '', note: '', ...patch };
}

export function newDesignProp(patch: Partial<DesignProp> = {}): DesignProp {
  return {
    id: uid('pr'),
    name: '',
    type: 'string',
    required: false,
    default: '',
    description: '',
    ...patch,
  };
}

type Section = { tag: string; arg: string; body: string };

function parseSections(raw: string): Section[] {
  const sections: { tag: string; arg: string; lines: string[] }[] = [];
  let current: { tag: string; arg: string; lines: string[] } | null = null;
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(SECTION_RE);
    if (match) {
      current = { tag: match[1].toLowerCase(), arg: match[2].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return sections.map((s) => ({ tag: s.tag, arg: s.arg, body: s.lines.join('\n').trim() }));
}

/**
 * The `=` that opens a default value, or null when there is none.
 *
 * Not simply the first one: `onSubmit: () => void` is a type, and `=` inside
 * `=>` or a comparison is part of it. Splitting on that turned the prop into
 * `onSubmit: () = > void` the moment it was read back.
 */
function splitDefault(rest: string): [string, string] | null {
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] !== '=') continue;
    const before = rest[i - 1];
    const after = rest[i + 1];
    if (after === '=' || after === '>') {
      i += 1;
      continue;
    }
    if (before === '=' || before === '!' || before === '<' || before === '>') continue;
    return [rest.slice(0, i).trim(), rest.slice(i + 1).trim()];
  }
  return null;
}

/** One `name: type! = default  # description` line. */
export function parseDesignPropLine(line: string): DesignProp | null {
  let rest = line.trim();
  if (!rest || rest.startsWith('#')) return null;

  let description = '';
  const withComment = rest.match(/^([\s\S]*?)\s+#\s?(.*)$/);
  if (withComment) {
    rest = withComment[1].trim();
    description = withComment[2].trim();
  }

  let defaultValue = '';
  const withDefault = splitDefault(rest);
  if (withDefault) {
    rest = withDefault[0];
    defaultValue = withDefault[1];
  }

  let required = false;
  if (rest.endsWith('!')) {
    required = true;
    rest = rest.slice(0, -1).trim();
  }

  const colon = rest.indexOf(':');
  const name = (colon < 0 ? rest : rest.slice(0, colon)).trim();
  if (!name) return null;
  return {
    id: uid('pr'),
    name,
    type: colon < 0 ? '' : rest.slice(colon + 1).trim(),
    required,
    default: defaultValue,
    description,
  };
}

export function parseDesignContract(raw: string): DesignContract {
  const text = (raw || '').trim();
  const out = emptyDesignContract();
  if (!text) return out;

  /* A link on its own is the contract in its shortest honest form — that is
     what the API stores when someone pastes one, and it parses back here. */
  if (!DESIGN_TAG_RE.test(text)) {
    if (isDesignRef(text)) out.node = text;
    return out;
  }

  for (const section of parseSections(text)) {
    const value = (section.arg || section.body).trim();
    if (section.tag === 'design') out.node = value.split(/\s+/)[0] || '';
    if (section.tag === 'version') out.version = value;
    if (section.tag === 'description') out.description = value;
    if (section.tag === 'a11y') out.a11y = value;
    if (section.tag === 'state') {
      const [name, ...note] = section.arg.split('#');
      const clean = name.trim();
      if (clean) out.states.push(newDesignState({ name: clean, note: note.join('#').trim() }));
    }
    if (section.tag === 'props') {
      for (const line of section.body.split('\n')) {
        const prop = parseDesignPropLine(line);
        if (prop) out.props.push(prop);
      }
    }
    if (section.tag === 'tokens') {
      out.tokens = value
        .split(/[,\n·]/)
        .map((token) => token.trim())
        .filter(Boolean);
    }
    if (section.tag === 'composes') {
      out.composes.push(...parseComposition(section.body || section.arg));
    }
  }
  return out;
}

function serializeProp(prop: DesignProp): string {
  const name = prop.name.trim();
  const type = prop.type.trim();
  const head = `${name}${type ? `: ${type}` : ''}${prop.required ? '!' : ''}`;
  const value = prop.default.trim() ? ` = ${prop.default.trim()}` : '';
  const description = prop.description.trim() ? `  # ${prop.description.trim()}` : '';
  return `${head}${value}${description}`;
}

/** The props block as text — one line each, the way it is typed. */
export function serializeProps(props: DesignProp[]): string {
  return props
    .filter((prop) => prop.name.trim())
    .map(serializeProp)
    .join('\n');
}

export function parseProps(text: string): DesignProp[] {
  return (text || '')
    .split('\n')
    .map((line) => parseDesignPropLine(line))
    .filter((prop): prop is DesignProp => prop !== null);
}

export function serializeDesignContract(contract: DesignContract): string {
  const blocks: string[][] = [];
  const head: string[] = [];
  if (contract.node.trim()) head.push(`@design ${canonicalDesignRef(contract.node)}`);
  if (contract.version.trim()) head.push(`@version ${contract.version.trim()}`);
  if (contract.description.trim()) head.push(`@description ${contract.description.trim()}`);
  if (head.length) blocks.push(head);

  const props = contract.props.filter((p) => p.name.trim());
  if (props.length) blocks.push(['@props', ...props.map(serializeProp)]);

  const states = contract.states.filter((s) => s.name.trim());
  if (states.length) {
    blocks.push(
      states.map((state) =>
        `@state ${state.name.trim()}${state.note.trim() ? `  # ${state.note.trim()}` : ''}`
      )
    );
  }

  const composition = serializeComposition(contract.composes);
  if (composition) blocks.push(['@composes', composition]);

  const tokens = contract.tokens.map((t) => t.trim()).filter(Boolean);
  if (tokens.length) blocks.push(['@tokens', tokens.join(', ')]);
  if (contract.a11y.trim()) blocks.push(['@a11y', contract.a11y.trim()]);

  return blocks.map((block) => block.join('\n')).join('\n\n');
}

/**
 * What blocks Apply. Deliberately short: the states and props are free text by
 * design, and the only thing that can be *wrong* rather than incomplete is a
 * reference that points nowhere and a state described twice.
 */
export function validateDesignContract(contract: DesignContract): DesignValidation {
  const node = contract.node.trim();
  if (node && !isDesignRef(node)) return { ok: false, error: 'design_node_invalid' };

  const named = contract.states.map((s) => s.name.trim().toLowerCase()).filter(Boolean);
  const duplicate = named.find((name, i) => named.indexOf(name) !== i);
  if (duplicate) return { ok: false, error: 'design_state_duplicate' };

  return { ok: true };
}

/**
 * Has something in it, but nothing that says anything.
 *
 * Deliberately not "no node": a project without a design tool describes its
 * components in states, props and parts, and calling that broken would put a
 * warning on every element such a project owns.
 */
export function designContractLooksBroken(raw: string): boolean {
  const text = (raw || '').trim();
  if (!text) return false;
  const contract = parseDesignContract(text);
  return (
    !contract.node &&
    !contract.states.length &&
    !contract.props.length &&
    !contract.composes.length &&
    !contract.description.trim()
  );
}

/** One line for a collapsed slot: what is bound, and how much is described. */
export function summarizeDesignContract(raw: string, empty: string): string {
  const text = (raw || '').trim();
  if (!text) return empty;
  const contract = parseDesignContract(text);
  const parts: string[] = [];
  if (contract.node) {
    const node = contract.node.match(/node-id=([\w:-]+)/)?.[1] ?? contract.node.split('#')[1];
    parts.push(node ? `node ${node.replace(/-/g, ':')}` : contract.node);
  }
  if (contract.states.length) parts.push(`${contract.states.length} states`);
  if (contract.composes.length) parts.push(`${contract.composes.length} parts`);
  if (contract.props.length) parts.push(`${contract.props.length} props`);
  return parts.length ? parts.join(' · ') : empty;
}
