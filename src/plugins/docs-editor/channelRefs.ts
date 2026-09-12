import type { ComponentBlock, FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import {
  channelSurfaceLabel,
  isBrokerChannel,
  normalizeChannelProtocol,
  normalizeChannelSchemaFormat,
  type ChannelExtras,
  type ChannelProtocol,
  type ChannelSchemaFormat,
} from '@/types/c4Extensions';
import { containerIdsForOwner, type DocOwnerType } from './endpointRefs';

export type ResolvedChannelRef = {
  id: string;
  name: string;
  description?: string;
  protocol: ChannelProtocol;
  schemaFormat: ChannelSchemaFormat;
  /** Topic / Queue / Exchange / Stream — the noun this broker uses. */
  surface: string;
  compatibility?: string;
  keySchema?: string;
  valueSchema?: string;
  headersSchema?: string;
  containerId: string;
  containerName?: string;
};

export type ChannelOption = Pick<
  ResolvedChannelRef,
  'id' | 'name' | 'protocol' | 'surface' | 'containerName'
>;

function componentToChannelRef(
  component: ComponentBlock,
  containerName?: string
): ResolvedChannelRef {
  const extras = component as ComponentBlock & ChannelExtras;
  const protocol = normalizeChannelProtocol(extras.protocol);
  return {
    id: component.id,
    name: component.name,
    description: component.description,
    protocol,
    schemaFormat: normalizeChannelSchemaFormat(extras.schemaFormat),
    surface: channelSurfaceLabel(protocol),
    compatibility: extras.compatibility ? String(extras.compatibility) : undefined,
    keySchema: extras.keySchema,
    valueSchema: extras.valueSchema,
    headersSchema: extras.headersSchema,
    containerId: component.containerId,
    containerName,
  };
}

export function collectChannelIndex(model: FlatC4Model): Map<string, ResolvedChannelRef> {
  const map = new Map<string, ResolvedChannelRef>();
  for (const component of model.components) {
    if (!isBrokerChannel(component)) continue;
    const container = model.containers.find((c) => c.id === component.containerId);
    map.set(component.id, componentToChannelRef(component, container?.name));
  }
  return map;
}

/**
 * Brokers are shared: the topic lives on the Kafka container while the doc that
 * describes it sits on the service producing or consuming it. Scoping the
 * picker to the owner's own container — the way endpoints are scoped — would
 * offer nothing in exactly that case, so channels also reach the containers the
 * owner is wired to. One hop, either direction: the edge to the broker is what
 * makes its topics this service's business, and nothing further is.
 */
function brokerScopedContainerIds(
  model: FlatC4Model,
  ownerType: DocOwnerType,
  ownerId: string
): Set<string> | null {
  const own = containerIdsForOwner(model, ownerType, ownerId);
  if (!own) return null;
  if (ownerType === 'system') return own;

  const reachable = new Set(own);
  for (const container of model.containers) {
    const targets = (container.connections ?? []).map((c) => c.targetId);
    if (own.has(container.id)) {
      for (const target of targets) reachable.add(target);
    } else if (targets.some((target) => own.has(target))) {
      reachable.add(container.id);
    }
  }
  return reachable;
}

export function collectChannelOptionsForOwner(
  model: FlatC4Model,
  ownerType: DocOwnerType,
  ownerId: string
): ChannelOption[] {
  const containerIds = brokerScopedContainerIds(model, ownerType, ownerId);
  if (!containerIds) return [];

  const options: ChannelOption[] = [];
  for (const component of model.components) {
    if (!isBrokerChannel(component) || !containerIds.has(component.containerId)) continue;
    const ref = componentToChannelRef(
      component,
      model.containers.find((c) => c.id === component.containerId)?.name
    );
    options.push({
      id: ref.id,
      name: ref.name,
      protocol: ref.protocol,
      surface: ref.surface,
      containerName: ref.containerName,
    });
  }

  return options.sort((a, b) => {
    const byProtocol = a.protocol.localeCompare(b.protocol);
    if (byProtocol) return byProtocol;
    return a.name.localeCompare(b.name);
  });
}

export function formatChannelOptionLabel(option: ChannelOption): string {
  const line = `${option.protocol} · ${option.name}`;
  return option.containerName ? `${line} — ${option.containerName}` : line;
}
