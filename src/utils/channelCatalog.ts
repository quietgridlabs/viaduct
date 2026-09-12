import type { ComponentBlock, ContainerBlock, FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { isBrokerChannel, type ChannelExtras } from '@/types/c4Extensions';

export type ChannelElement = ComponentBlock & ChannelExtras;

export function containerChannels(model: FlatC4Model, containerId: string): ChannelElement[] {
  return model.components.filter(
    (c) => c.containerId === containerId && isBrokerChannel(c)
  ) as ChannelElement[];
}

export function channelCountForCard(
  model: FlatC4Model,
  ownerId: string,
  opts?: { originalType?: string; originalId?: string } | null
): { containerId: string; count: number } | null {
  const resolveId =
    opts?.originalType === 'container' && opts.originalId ? opts.originalId : ownerId;

  if (opts?.originalType === 'system') {
    let total = 0;
    let firstId: string | null = null;
    for (const c of model.containers) {
      if (c.systemId !== ownerId || (c as ContainerBlock & { original?: unknown }).original) {
        continue;
      }
      const n = containerChannels(model, c.id).length;
      if (n > 0 && !firstId) firstId = c.id;
      total += n;
    }
    if (!total || !firstId) return null;
    return { containerId: firstId, count: total };
  }

  const count = containerChannels(model, resolveId).length;
  if (!count) return null;
  return { containerId: resolveId, count };
}
