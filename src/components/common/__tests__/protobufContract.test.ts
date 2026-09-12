import { describe, expect, it } from 'vitest';
import {
  extractMessageName,
  parseProtobufContract,
  serializeProtobufContract,
  validateProtobufContract,
  validateProtobufSource,
} from '../ProtobufContract';

const SAMPLE = `message GetUserRequest {
  string user_id = 1;
  string tenant = 2;
}`;

describe('protobufContract', () => {
  it('extracts the message name from source', () => {
    expect(extractMessageName(SAMPLE)).toBe('GetUserRequest');
  });

  it('round-trips tags and source', () => {
    const stored = serializeProtobufContract({
      side: 'request',
      mode: 'protobuf',
      name: 'GetUserRequest',
      source: SAMPLE,
      stream: 'server',
    });
    expect(stored).toContain('@name GetUserRequest');
    expect(stored).toContain('@stream server');
    expect(stored).toContain('message GetUserRequest');

    const parsed = parseProtobufContract(stored, 'request');
    expect(parsed.name).toBe('GetUserRequest');
    expect(parsed.stream).toBe('server');
    expect(parsed.source).toContain('string user_id = 1');
  });

  it('parses bare protobuf without tags', () => {
    const parsed = parseProtobufContract(SAMPLE, 'response');
    expect(parsed.name).toBe('GetUserRequest');
    expect(parsed.source).toContain('tenant = 2');
    expect(parsed.stream).toBe('unary');
  });

  it('accepts a valid message', () => {
    const result = validateProtobufSource(SAMPLE);
    expect(result.ok).toBe(true);
  });

  it('rejects unclosed braces', () => {
    const result = validateProtobufSource('message Foo { string id = 1;');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/brace/i);
  });

  it('rejects duplicate field numbers', () => {
    const result = validateProtobufSource(`message Foo {
  string a = 1;
  string b = 1;
}`);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Duplicate field number/i);
  });

  it('rejects missing message declaration', () => {
    const result = validateProtobufSource('string id = 1;');
    expect(result.ok).toBe(false);
  });

  it('warns on reserved field number range', () => {
    const result = validateProtobufSource(`message Foo {
  string a = 19000;
}`);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => /reserved/i.test(w))).toBe(true);
  });

  it('validateProtobufContract requires a valid identifier name', () => {
    const result = validateProtobufContract({
      side: 'request',
      mode: 'protobuf',
      name: 'bad-name',
      source: SAMPLE,
      stream: 'unary',
    });
    expect(result.ok).toBe(false);
  });
});
