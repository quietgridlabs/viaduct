import { channelSchemaViewer, sniffContractViewer } from '../embedLanguage';

describe('channelSchemaViewer', () => {
  it('treats every JSON-shaped schema format as json', () => {
    expect(channelSchemaViewer('avro')).toBe('json');
    expect(channelSchemaViewer('json-schema')).toBe('json');
    expect(channelSchemaViewer('cloudevents')).toBe('json');
  });

  it('gives protobuf its own grammar', () => {
    expect(channelSchemaViewer('protobuf')).toBe('protobuf');
  });
});

describe('sniffContractViewer', () => {
  it('recognises JSON bodies and arrays', () => {
    expect(sniffContractViewer('{ "id": 1 }')).toBe('json');
    expect(sniffContractViewer('\n  [\n  {"a": 1}\n]\n')).toBe('json');
  });

  it('recognises protobuf by its syntax line or a message block', () => {
    expect(sniffContractViewer('syntax = "proto3";\nmessage A {}')).toBe('protobuf');
    expect(sniffContractViewer('message Payment {\n  string id = 1;\n}')).toBe('protobuf');
  });

  it('leaves prose alone rather than guessing a language', () => {
    // Endpoint bodies are free text; a description highlighted as code grows
    // keywords it never had.
    expect(sniffContractViewer('Proxy response from BaaS /internal/platform')).toBeNull();
    expect(sniffContractViewer('Authorization to BaaS and platform')).toBeNull();
    expect(sniffContractViewer('   ')).toBeNull();
    expect(sniffContractViewer('')).toBeNull();
    // No themed XML viewer exists, so markup stays a plain block too.
    expect(sniffContractViewer('<Envelope><Body/></Envelope>')).toBeNull();
  });
});
