import type { ChannelProtocol, ChannelSchemaFormat } from '@/types/c4Extensions';

export type ChannelPreset = {
  id: string;
  label: string;
  description: string;
  name: string;
  protocol: ChannelProtocol;
  schemaFormat: ChannelSchemaFormat;
};

export const BROKER_CHANNEL_PRESETS: ChannelPreset[] = [
  {
    id: 'topic-created',
    label: 'orders.created',
    description: 'Kafka topic · domain event',
    name: 'orders.created',
    protocol: 'kafka',
    schemaFormat: 'avro',
  },
  {
    id: 'topic-updated',
    label: 'orders.updated',
    description: 'Kafka topic · state change',
    name: 'orders.updated',
    protocol: 'kafka',
    schemaFormat: 'avro',
  },
  {
    id: 'queue-jobs',
    label: 'jobs',
    description: 'Queue · background work',
    name: 'jobs',
    protocol: 'sqs',
    schemaFormat: 'json-schema',
  },
];

export function defaultChannelName(protocol: ChannelProtocol): string {
  if (protocol === 'sqs' || protocol === 'amqp') return 'new-queue';
  if (protocol === 'redis-stream') return 'new-stream';
  return 'events.new';
}
