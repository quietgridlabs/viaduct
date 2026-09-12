import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import * as messageBrokersJson from '@data/technologies/messageBrokers.json';
import {
  normalizeChannelProtocol,
  type ChannelProtocol,
} from '@/types/c4Extensions';
import { techIdsFromJson } from './databaseTech';

const BROKER_TECH_IDS = techIdsFromJson(messageBrokersJson);

const BROKER_TECH_ALIASES: Record<string, string> = {
  apachekafka: 'kafka',
  'apache-kafka': 'kafka',
};

export function canonicalBrokerTechId(technologyId?: string | null): string {
  const raw = String(technologyId || '')
    .trim()
    .toLowerCase();
  return BROKER_TECH_ALIASES[raw] || raw;
}

export function isBrokerTechnology(technologyId?: string | null): boolean {
  if (!technologyId) return false;
  const canonical = canonicalBrokerTechId(technologyId);
  return BROKER_TECH_IDS.has(canonical) || BROKER_TECH_IDS.has(technologyId);
}

/** Component-layer view of a broker container → channel (topic/queue) editor. */
export function isBrokerView(
  model: Pick<FlatC4Model, 'viewLevel' | 'activeContainerId' | 'containers'>
): boolean {
  if (model.viewLevel !== 'component' || !model.activeContainerId) return false;
  const container = model.containers.find((c) => c.id === model.activeContainerId);
  return isBrokerTechnology(container?.technology);
}

export function protocolFromBrokerTech(
  technologyId?: string | null
): ChannelProtocol {
  const id = canonicalBrokerTechId(technologyId);
  if (id === 'rabbitmq') return 'amqp';
  if (id === 'amazonsqs') return 'sqs';
  if (id === 'redisstreams') return 'redis-stream';
  if (id === 'nats' || id === 'mqtt' || id === 'kafka') {
    return normalizeChannelProtocol(id);
  }
  return 'kafka';
}

export function inferChannelRole(opts: {
  sourceIsBroker: boolean;
  targetIsBroker: boolean;
}): 'produce' | 'consume' {
  if (opts.targetIsBroker && !opts.sourceIsBroker) return 'produce';
  if (opts.sourceIsBroker && !opts.targetIsBroker) return 'consume';
  return 'produce';
}
