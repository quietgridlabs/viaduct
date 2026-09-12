/**
 * Duck hop easter egg — Ctrl+Shift+Q on the editor canvas.
 * The navbar duck drops onto a node; arrows and space hop between elements.
 */

export type DuckHopPhase = 'idle' | 'entering' | 'playing' | 'exiting';

export type DuckHopSnapshot = {
  phase: DuckHopPhase;
  currentNodeId: string | null;
};

let snapshot: DuckHopSnapshot = { phase: 'idle', currentNodeId: null };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getDuckHopSnapshot(): DuckHopSnapshot {
  return snapshot;
}

export function subscribeDuckHop(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDuckHopActive(): boolean {
  return snapshot.phase !== 'idle';
}

export function startDuckHopGame(nodeId: string): void {
  snapshot = { phase: 'playing', currentNodeId: nodeId };
  emit();
}

export function setDuckHopNode(nodeId: string): void {
  if (snapshot.phase !== 'playing' && snapshot.phase !== 'entering') return;
  snapshot = { ...snapshot, currentNodeId: nodeId, phase: 'playing' };
  emit();
}

export function finishDuckHopEnter(): void {
  if (snapshot.phase !== 'entering') return;
  snapshot = { ...snapshot, phase: 'playing' };
  emit();
}

export function exitDuckHopGame(): void {
  if (snapshot.phase === 'idle' || snapshot.phase === 'exiting') return;
  snapshot = { ...snapshot, phase: 'exiting' };
  emit();
}

export function resetDuckHopGame(): void {
  if (snapshot.phase === 'idle' && snapshot.currentNodeId === null) return;
  snapshot = { phase: 'idle', currentNodeId: null };
  emit();
}
