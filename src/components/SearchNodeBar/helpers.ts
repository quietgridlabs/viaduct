import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { isNearBottom as nearBottom } from '@utils/scrollPaging';
import { SEARCH_LOAD_MORE_PX } from './constants';

/** Where the connection was let go of, mouse or finger. */
export function pointerClientPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('changedTouches' in event && event.changedTouches[0]) {
    return {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
    };
  }
  const mouse = event as MouseEvent;
  return { x: mouse.clientX, y: mouse.clientY };
}

/**
 * The handle facing the one the connection was dragged from.
 *
 * Source and target arrays are laid out differently on C4Block:
 *   source: right-0, bottom-1, left-2, top-3
 *   target: left-0, top-1, bottom-2, right-3
 * So a naive `source-left` → `target-right` that keeps the index lands on
 * `target-right-2`, which does not exist — React Flow then draws nothing, the
 * connection still sits in the model, and a second drag to the clone is refused
 * as a duplicate. Map by side, not by index.
 */
export function mirrorTargetHandleFromSource(sourceHandle?: string | null): string | undefined {
  if (!sourceHandle) return undefined;
  if (sourceHandle.includes('source-right')) return 'target-left-0';
  if (sourceHandle.includes('source-bottom')) return 'target-top-1';
  if (sourceHandle.includes('source-left')) return 'target-right-3';
  if (sourceHandle.includes('source-top')) return 'target-bottom-2';
  return undefined;
}

/** React Flow hands back either a handle id or the handle itself. */
export function handleIdOf(fromHandle: unknown): string | undefined {
  if (typeof fromHandle === 'string') return fromHandle;
  return (fromHandle as { id?: string } | null | undefined)?.id;
}

const COLLECTION_BY_LEVEL: Record<string, keyof FlatC4Model> = {
  system: 'systems',
  container: 'containers',
  component: 'components',
  code: 'codeElements',
};

/**
 * Whether the connection actually landed in the model.
 *
 * Used after writing one with mirrored handles: if the write was refused for
 * another reason, the caller falls back to a plain connection so the new
 * clone is not left unwired.
 */
export function hasConnectionTo(
  model: FlatC4Model,
  level: string,
  sourceId: string,
  targetId: string
): boolean {
  const key = COLLECTION_BY_LEVEL[level];
  if (!key) return false;
  const list = model[key] as
    | Array<{ id: string; connections?: { targetId: string }[] }>
    | undefined;
  return Boolean(
    list?.find((entry) => entry.id === sourceId)?.connections?.some((c) => c.targetId === targetId)
  );
}

/** Whether the results list has reached the point of asking for more. */
export function isNearBottom(el: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): boolean {
  return nearBottom(el, SEARCH_LOAD_MORE_PX);
}
