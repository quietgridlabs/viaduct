/**
 * Broker channel schemas — Avro / JSON Schema / protobuf / CloudEvents
 * stored as tagged text, same idea as protobufContract.
 *
 *   @format avro
 *   @name PaymentSettled
 *
 *   { "type": "record", "name": "PaymentSettled", "fields": [ … ] }
 *
 * Validation is lightweight: parse + structural checks. Enough to catch a
 * broken brace or a record without fields before Apply.
 */

import {
  normalizeChannelSchemaFormat,
  type ChannelSchemaFormat,
} from '@/types/c4Extensions';
import {
  validateProtobufSource,
  type ProtobufMarker,
  type ProtobufValidation,
} from '../ProtobufContract';

export type ChannelSchemaSide = 'key' | 'value' | 'headers';

export type ChannelSchemaContract = {
  side: ChannelSchemaSide;
  format: ChannelSchemaFormat;
  name: string;
  source: string;
};

export type ChannelSchemaValidation = ProtobufValidation;

/** Avro, JSON Schema and CloudEvents are all JSON documents; protobuf is not. */
export function isJsonishFormat(format: ChannelSchemaFormat): boolean {
  return format === 'avro' || format === 'json-schema' || format === 'cloudevents';
}

function emptyContract(
  side: ChannelSchemaSide,
  format: ChannelSchemaFormat
): ChannelSchemaContract {
  return { side, format, name: '', source: '' };
}

export function emptyChannelSchema(
  side: ChannelSchemaSide,
  format: ChannelSchemaFormat = 'avro'
): ChannelSchemaContract {
  return emptyContract(side, format);
}

export function serializeChannelSchema(contract: ChannelSchemaContract): string {
  const lines: string[] = [`@format ${contract.format}`];
  const name = contract.name.trim();
  if (name) lines.push(`@name ${name}`);
  const source = contract.source.trim();
  if (source) {
    lines.push('');
    lines.push(source);
  }
  return lines.join('\n').trim();
}

export function parseChannelSchema(
  raw: string,
  side: ChannelSchemaSide,
  fallbackFormat: ChannelSchemaFormat = 'avro'
): ChannelSchemaContract {
  const contract = emptyContract(side, fallbackFormat);
  const text = String(raw || '');
  if (!text.trim()) return contract;

  const lines = text.split(/\r?\n/);
  const sourceLines: string[] = [];
  let sawTag = false;
  let inSource = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inSource && trimmed.startsWith('@')) {
      sawTag = true;
      const match = /^@(\w+)\s*(.*)$/.exec(trimmed);
      if (!match) continue;
      const tag = match[1].toLowerCase();
      const rest = match[2].trim();
      if (tag === 'format' && rest) {
        contract.format = normalizeChannelSchemaFormat(rest, fallbackFormat);
      } else if (tag === 'name' && rest) {
        contract.name = rest.split(/\s+/)[0];
      }
      continue;
    }
    if (sawTag && !trimmed && !inSource) {
      inSource = true;
      continue;
    }
    if (sawTag) inSource = true;
    sourceLines.push(line);
  }

  if (!sawTag) {
    contract.source = text.trim();
  } else {
    contract.source = sourceLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  }

  if (!contract.name) contract.name = inferSchemaName(contract.source, contract.format);
  return contract;
}

function inferSchemaName(source: string, format: ChannelSchemaFormat): string {
  const text = source.trim();
  if (!text) return '';
  if (format === 'protobuf') {
    const match = /(?:^|\n)\s*message\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(text);
    return match?.[1] || '';
  }
  try {
    const parsed = JSON.parse(text) as { name?: unknown; title?: unknown };
    if (typeof parsed?.name === 'string') return parsed.name;
    if (typeof parsed?.title === 'string') return parsed.title;
  } catch {
    /* not JSON — leave unnamed */
  }
  return '';
}

function marker(
  message: string,
  severity: 'error' | 'warning' = 'error'
): ProtobufMarker {
  return { line: 1, column: 1, endColumn: 2, message, severity };
}

function jsonOk(source: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(source) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' };
  }
}

function validateAvro(source: string): ChannelSchemaValidation {
  const parsed = jsonOk(source);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, warnings: [], markers: [marker(parsed.error)] };
  }
  const value = parsed.value;
  if (typeof value === 'string') {
    return { ok: true, warnings: [], markers: [] };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: 'Avro schema must be a type name or a record object',
      warnings: [],
      markers: [marker('Expected an Avro type object')],
    };
  }
  const rec = value as { type?: unknown; name?: unknown; fields?: unknown };
  if (rec.type === 'record') {
    if (typeof rec.name !== 'string' || !rec.name.trim()) {
      return {
        ok: false,
        error: 'Avro record requires a name',
        warnings: [],
        markers: [marker('Record name is missing')],
      };
    }
    if (!Array.isArray(rec.fields)) {
      return {
        ok: false,
        error: 'Avro record requires a fields array',
        warnings: [],
        markers: [marker('fields must be an array')],
      };
    }
  }
  return { ok: true, warnings: [], markers: [] };
}

function validateJsonSchema(source: string): ChannelSchemaValidation {
  const parsed = jsonOk(source);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, warnings: [], markers: [marker(parsed.error)] };
  }
  if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    return {
      ok: false,
      error: 'JSON Schema must be an object',
      warnings: [],
      markers: [marker('Expected a JSON Schema object')],
    };
  }
  return { ok: true, warnings: [], markers: [] };
}

export function validateChannelSchema(
  contract: ChannelSchemaContract
): ChannelSchemaValidation {
  const source = contract.source.trim();
  if (!source) {
    return {
      ok: true,
      warnings: contract.name.trim() ? ['Schema name is set but the body is empty'] : [],
      markers: [],
    };
  }
  if (contract.format === 'protobuf') {
    return validateProtobufSource(source);
  }
  if (contract.format === 'avro') return validateAvro(source);
  return validateJsonSchema(source);
}

export function summarizeChannelSchema(raw: string, emptyLabel: string): string {
  if (!raw.trim()) return emptyLabel;
  const contract = parseChannelSchema(raw, 'value');
  if (!validateChannelSchema(contract).ok) return `Invalid ${contract.format}`;
  const name = contract.name.trim() || inferSchemaName(contract.source, contract.format);
  return name ? `${contract.format} · ${name}` : contract.format;
}

export function contractLooksBrokenChannel(raw: string): boolean {
  if (!raw.trim()) return false;
  return !validateChannelSchema(parseChannelSchema(raw, 'value')).ok;
}

export const SAMPLE_AVRO_RECORD = `{
  "type": "record",
  "name": "ExampleEvent",
  "fields": [
    { "name": "id", "type": "string" }
  ]
}`;
