/**
 * Domains catalog overlay — same pattern as change sets / service catalog.
 * Only UI session state; domain data lives in the C4 model (Zustand).
 */
import { useSyncExternalStore } from 'react';

type DomainsOverlaySession = {
  selectedId?: string;
} | null;

type DomainsOverlayState = {
  session: DomainsOverlaySession;
};

let state: DomainsOverlayState = { session: null };
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DomainsOverlaySession {
  return state.session;
}

export function subscribeDomainsOverlay(listener: () => void): () => void {
  return subscribe(listener);
}

export function getDomainsOverlay(): DomainsOverlaySession {
  return state.session;
}

export function openDomainsOverlay(next?: NonNullable<DomainsOverlaySession>): void {
  state = { session: { selectedId: next?.selectedId } };
  notify();
}

export function closeDomainsOverlay(): void {
  if (!state.session) return;
  state = { session: null };
  notify();
}

export function useDomainsOverlay(): DomainsOverlaySession {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
