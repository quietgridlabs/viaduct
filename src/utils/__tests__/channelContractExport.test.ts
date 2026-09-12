import { describe, expect, it } from 'vitest';
import type { ChannelElement } from '../channelCatalog';
import {
  buildChannelExportDocument,
  buildChannelExportFiles,
  channelExportDownloadName,
  exportChannelContractBlob,
} from '../ChannelContractExport';

function channel(partial: Partial<ChannelElement> & { name: string }): ChannelElement {
  return {
    id: 'ch1',
    type: 'component',
    systemId: 'sys',
    containerId: 'bus',
    position: { x: 0, y: 0 },
    connections: [],
    kind: 'channel',
    protocol: 'kafka',
    schemaFormat: 'avro',
    ...partial,
  } as ChannelElement;
}

const VALUE_AVRO = `@format avro
@name PaymentSettled

{
  "type": "record",
  "name": "PaymentSettled",
  "fields": [{ "name": "paymentId", "type": "string" }]
}`;

describe('channelContractExport', () => {
  it('builds a manifest with parsed Avro value schema', () => {
    const doc = buildChannelExportDocument(
      channel({
        name: 'payment.settled',
        description: 'Ledger confirmed',
        compatibility: 'backward',
        valueSchema: VALUE_AVRO,
      })
    );
    expect(doc.kind).toBe('channel');
    expect(doc.protocol).toBe('kafka');
    expect(doc.surface).toBe('Topic');
    expect(doc.schemaFormat).toBe('avro');
    expect(doc.compatibility).toBe('backward');
    expect(doc.schemas.key).toBeNull();
    expect(doc.schemas.value).toEqual({
      type: 'record',
      name: 'PaymentSettled',
      fields: [{ name: 'paymentId', type: 'string' }],
    });
  });

  it('emits channel.json alone when there are no schemas', () => {
    const files = buildChannelExportFiles(channel({ name: 'orders.created' }));
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('channel.json');
    expect(channelExportDownloadName(channel({ name: 'orders.created' }), files)).toBe(
      'orders-created-channel.json'
    );
  });

  it('adds .avsc files for populated sides and zips them', () => {
    const ch = channel({
      name: 'payment.settled',
      valueSchema: VALUE_AVRO,
      keySchema: `@format avro

{ "type": "string" }`,
    });
    const files = buildChannelExportFiles(ch);
    expect(files.map((f) => f.filename).sort()).toEqual([
      'channel.json',
      'payment-settled.key.avsc',
      'payment-settled.value.avsc',
    ]);
    expect(files.find((f) => f.filename.endsWith('.value.avsc'))?.content).toContain(
      '"PaymentSettled"'
    );

    const { blob, filename } = exportChannelContractBlob(ch);
    expect(filename).toBe('payment-settled-channel.zip');
    expect(blob.type).toBe('application/zip');
  });

  it('exports protobuf source as .proto', () => {
    const files = buildChannelExportFiles(
      channel({
        name: 'jobs',
        schemaFormat: 'protobuf',
        valueSchema: `@format protobuf
@name JobEvent

message JobEvent {
  string id = 1;
}`,
      })
    );
    expect(files.some((f) => f.filename === 'jobs.value.proto')).toBe(true);
    expect(files.find((f) => f.filename.endsWith('.proto'))?.content).toContain('message JobEvent');
  });
});
