/**
 * Which service contract the viewer is showing.
 *
 * Same shape as the sequence-diagram sidebar's state: a module-level value the
 * badge writes and the overlay subscribes to, so a node deep in the canvas can
 * open it without threading props through the editor.
 */
export type ServiceContractTarget = {
  containerId: string;
  containerName: string;
  /**
   * When the owner isn't in the local model (remote clone), the card already
   * carries the original's OpenAPI from live projection — pass it so the
   * viewer can open without a store lookup.
   */
  openapi?: string;
  /** Opened straight from "Import OpenAPI": go to the file picker, not the list. */
  autoImport?: boolean;
} | null;

type Listener = () => void;

let target: ServiceContractTarget = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openServiceContract(next: NonNullable<ServiceContractTarget>): void {
  target = next;
  emit();
}

export function closeServiceContract(): void {
  if (!target) return;
  target = null;
  emit();
}

export function getServiceContractTarget(): ServiceContractTarget {
  return target;
}

export function subscribeServiceContract(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
