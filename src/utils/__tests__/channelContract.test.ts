import {
  contractLooksBrokenChannel,
  parseChannelSchema,
  serializeChannelSchema,
  summarizeChannelSchema,
  validateChannelSchema,
} from '@components/common/ChannelContract';

describe('channelContract', () => {
  it('round-trips tagged Avro', () => {
    const raw = serializeChannelSchema({
      side: 'value',
      format: 'avro',
      name: 'PaymentSettled',
      source: '{"type":"record","name":"PaymentSettled","fields":[]}',
    });
    const parsed = parseChannelSchema(raw, 'value');
    expect(parsed.format).toBe('avro');
    expect(parsed.name).toBe('PaymentSettled');
    expect(validateChannelSchema(parsed).ok).toBe(true);
  });

  it('accepts a bare JSON Avro record without tags', () => {
    const parsed = parseChannelSchema(
      '{"type":"record","name":"Foo","fields":[{"name":"id","type":"string"}]}',
      'value'
    );
    expect(parsed.name).toBe('Foo');
    expect(validateChannelSchema(parsed).ok).toBe(true);
  });

  it('rejects a record without fields', () => {
    const parsed = parseChannelSchema(
      '{"type":"record","name":"Foo"}',
      'value'
    );
    expect(validateChannelSchema(parsed).ok).toBe(false);
    expect(contractLooksBrokenChannel(serializeChannelSchema(parsed))).toBe(true);
  });

  it('summarises a valid schema', () => {
    const raw = serializeChannelSchema({
      side: 'key',
      format: 'avro',
      name: 'PaymentId',
      source: '"string"',
    });
    expect(summarizeChannelSchema(raw, 'none')).toBe('avro · PaymentId');
    expect(summarizeChannelSchema('', 'none')).toBe('none');
  });
});
