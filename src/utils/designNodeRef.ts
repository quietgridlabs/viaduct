import {
  listDesignSystems,
  type DesignSystemRecord,
  type ModelWithDesignSystems,
} from '@/types/c4Extensions';

/**
 * The two ways an element names a frame, and getting between them.
 *
 * A Figma link is forty characters of file key, a slug and tracking
 * parameters, and every element of a front end carries the same forty
 * characters with four digits different at the end. That is a lot of pasting
 * for one number, and a lot of places for the wrong file to creep in.
 *
 * So the short form: `public-web#7:25` — the design system, which already
 * knows its file, and the node inside it. The long form still works and is
 * still what somebody pastes; this turns it into the short one the moment the
 * file is recognised, and back into a link whenever one is needed.
 *
 * The server agrees, in `modelMutate.js#resolveDesignNode`.
 */

const FILE_URL_RE = /^https?:\/\/(?:[\w-]+\.)?figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)/i;
/** `system#12:345`, the same shape the contract format accepts. */
const REF_RE = /^([A-Za-z0-9._-]{1,64})#([A-Za-z0-9:;_-]{1,64})$/;

export type FigmaTarget = { fileKey: string; nodeId: string | null };

/** Figma writes `7-25` in a URL and `7:25` everywhere else. Same node. */
export function normalizeNodeId(raw: string): string {
  return String(raw || '').trim().replace(/-/g, ':');
}

export function parseFigmaUrl(value: string): FigmaTarget | null {
  const text = String(value || '').trim();
  const match = text.match(FILE_URL_RE);
  if (!match) return null;
  let nodeId: string | null = null;
  try {
    const raw = new URL(text).searchParams.get('node-id');
    if (raw) nodeId = normalizeNodeId(raw);
  } catch {
    /* Nearly a URL still gives up its file key, which is the useful half. */
  }
  return { fileKey: match[1], nodeId };
}

/** The file a design system reads from, when that is a Figma file. */
export function systemFileKey(system: DesignSystemRecord | null | undefined): string | null {
  if (system?.source?.kind !== 'figma') return null;
  return parseFigmaUrl(system.source.ref || '')?.fileKey ?? null;
}

/** Every system a node could be named against. */
export function listFigmaSystems(
  model: ModelWithDesignSystems | null | undefined
): DesignSystemRecord[] {
  return listDesignSystems(model).filter((system) => systemFileKey(system));
}

export function splitNodeRef(node: string): { system: string; nodeId: string } | null {
  const match = String(node || '').trim().match(REF_RE);
  /* A contract written by hand or by an agent may carry the URL's dash;
     what comes out of here is the node's one name. */
  return match ? { system: match[1], nodeId: normalizeNodeId(match[2]) } : null;
}

/**
 * Whether a system's name can be said in the short form at all.
 *
 * `@design` takes the node as the first word after the tag, so a reference
 * cannot contain a space — which means a system called "Figma redesign
 * weather" has no short form, and writing one anyway produces a string that
 * parses back as neither a reference nor a link. That is exactly what happened:
 * the field filled itself with `Figma redesign weather#`, refused the node id
 * and dropped the picker back to "paste a link".
 */
export function canUseShortRef(system: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(String(system || '').trim());
}

/**
 * The stored value for a system and a node id.
 *
 * The short form where the name allows it, and the file's own URL where it
 * does not — either way the person types only the node id, and either way it
 * reads back into this field as the system it came from.
 */
export function buildNodeRef(
  model: ModelWithDesignSystems | null | undefined,
  system: string,
  nodeId: string
): string {
  const id = normalizeNodeId(nodeId);
  const name = String(system || '').trim();
  if (!name || !id) return '';
  if (canUseShortRef(name)) return `${name}#${id}`;

  const wanted = name.toLowerCase();
  const owner = listFigmaSystems(model).find(
    (entry) => entry.name.trim().toLowerCase() === wanted
  );
  const base = owner?.source?.ref?.split('?')[0];
  /* No file to build a link from and no short form to fall back on: better an
     empty value than a string nothing can read. */
  if (!base) return '';
  return `${base}?node-id=${id.replace(/:/g, '-')}`;
}

/**
 * What the node field should show for a stored value.
 *
 * A pasted link whose file is one this project already knows becomes that
 * system plus a node id — the point of the exercise. A link to a file nobody
 * has recorded stays a link, because turning it into `something#7:25` would
 * invent a system that does not exist.
 */
export function readNodeValue(
  model: ModelWithDesignSystems | null | undefined,
  node: string
): { system: string; nodeId: string; link: string } {
  const text = String(node || '').trim();
  if (!text) return { system: '', nodeId: '', link: '' };

  const short = splitNodeRef(text);
  if (short) return { system: short.system, nodeId: short.nodeId, link: '' };

  const target = parseFigmaUrl(text);
  if (!target) return { system: '', nodeId: '', link: text };

  const owner = listFigmaSystems(model).find((system) => systemFileKey(system) === target.fileKey);
  if (owner && target.nodeId) return { system: owner.name, nodeId: target.nodeId, link: '' };
  return { system: '', nodeId: '', link: text };
}

/**
 * A link to open, whatever form the node is written in.
 *
 * @returns null when the short form names a system this project does not hold,
 *   or holds without a file. A name is not a link until something says where
 *   it points, and pretending otherwise produces a 404 in a new tab.
 */
export function resolveNodeHref(
  model: ModelWithDesignSystems | null | undefined,
  node: string
): string | null {
  const text = String(node || '').trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;

  const short = splitNodeRef(text);
  if (!short) return null;
  const wanted = short.system.toLowerCase();
  const owner = listFigmaSystems(model).find(
    (system) => system.name.trim().toLowerCase() === wanted || system.id === short.system
  );
  const base = owner?.source?.ref?.split('?')[0];
  if (!base) return null;
  return `${base}?node-id=${short.nodeId.replace(/:/g, '-')}`;
}
