import { useSyncExternalStore } from 'react';
import { normalizeTag } from '@/types/c4Extensions';

/*
 * Tags that exist before anything wears them.
 *
 * The model's catalogue is derived: `collectTagUsage` reads the tags off the
 * elements, so a tag exists exactly as long as something carries it. That is
 * right for the catalogue and wrong for creating one — a tag named in the rail
 * and not yet applied to anything would have nowhere to be, and would be gone
 * by the next render.
 *
 * So it is kept where the rest of the project is kept. A naming scheme a team
 * agrees on is not one person's note: held in this browser it would be visible
 * only to whoever typed it, and the next person to open the project would be
 * invited to invent the same names again. On the server it belongs to the
 * project, like its name and its version pattern.
 *
 * Local work has no server to put it on, so there it falls back to this
 * browser — which is all a model that lives in this browser can offer anyway.
 */

const STORAGE_KEY = 'c4-declared-tags';

/**
 * Where the list is read from and written to. Set once the workspace knows
 * whether it is on a project or working locally; until then, and for local
 * work, that is this browser.
 */
type Sink = (tags: string[]) => void;
let save: Sink = writeLocal;

function writeLocal(next: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Session-only is better than refusing the tag. */
  }
}

function readLocal(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag));
  } catch {
    return [];
  }
}

let current = readLocal();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): string[] {
  return current;
}

function write(next: string[]): void {
  current = next;
  save(next);
  listeners.forEach((listener) => listener());
}

/**
 * Points the list at a project, with the tags that project already has.
 *
 * Called again on every project switch, so the list never carries one
 * project's names into another.
 */
export function attachDeclaredTagsToProject(tags: string[], persist: Sink): void {
  save = persist;
  current = [...tags];
  listeners.forEach((listener) => listener());
}

/** Back to this browser: local work, or no project open. */
export function attachDeclaredTagsToBrowser(): void {
  save = writeLocal;
  current = readLocal();
  listeners.forEach((listener) => listener());
}

/** Adds the tag if it is new, and answers with what it ended up being called. */
export function declareTag(raw: string): string | null {
  const tag = normalizeTag(raw);
  if (!tag) return null;
  const already = current.some((existing) => existing.toLowerCase() === tag.toLowerCase());
  if (!already) write([...current, tag]);
  return tag;
}

/** Drops it from the list; whether anything still wears it is the model's business. */
export function undeclareTag(raw: string): void {
  const tag = normalizeTag(raw).toLowerCase();
  if (!tag) return;
  const next = current.filter((existing) => existing.toLowerCase() !== tag);
  if (next.length !== current.length) write(next);
}

export function useDeclaredTags(): string[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * The model's tags plus the ones only named so far, in one list with no
 * duplicates — a tag that has since been applied is in both, and the model's
 * spelling of it wins.
 */
export function mergeDeclaredTags(modelTags: string[], declared: string[]): string[] {
  const seen = new Set(modelTags.map((tag) => tag.toLowerCase()));
  return [...modelTags, ...declared.filter((tag) => !seen.has(tag.toLowerCase()))];
}
