/**
 * Which broker's channel contracts the viewer is showing.
 *
 * Same pattern as service-contract/uiState: badge writes, overlay subscribes,
 * no prop drilling through the canvas.
 */
export type ChannelContractTarget = {
  containerId: string;
  containerName: string;
  /** Prefer this topic/queue when the overlay opens (catalog deep-link). */
  channelId?: string;
} | null;

type Listener = () => void;

let target: ChannelContractTarget = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openChannelContract(next: NonNullable<ChannelContractTarget>): void {
  target = next;
  emit();
}

export function closeChannelContract(): void {
  if (!target) return;
  target = null;
  emit();
}

export function getChannelContractTarget(): ChannelContractTarget {
  return target;
}

export function subscribeChannelContract(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
