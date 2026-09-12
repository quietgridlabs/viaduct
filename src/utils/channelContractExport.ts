/**
 * Download a broker channel's contract — metadata plus key/value/headers
 * schema bodies as separate files (what you'd drop into a registry or repo).
 *
 * One schema side only → that file alone. Several sides (or empty) → ZIP with
 * channel.json + schema files. AsyncAPI is out of scope for v1.
 */

import {
  parseChannelSchema,
  type ChannelSchemaSide,
} from '@components/common/ChannelContract';
import {
  channelSurfaceLabel,
  normalizeChannelCompatibility,
  normalizeChannelProtocol,
  normalizeChannelSchemaFormat,
  type ChannelExtras,
  type ChannelSchemaFormat,
} from '@/types/c4Extensions';
import type { ChannelElement } from '@utils/channelCatalog';
import { strToU8, zipSync } from 'fflate';

export type ChannelExportFile = {
  filename: string;
  content: string;
};

export type ChannelExportDocument = {
  kind: 'channel';
  name: string;
  protocol: string;
  surface: string;
  schemaFormat: ChannelSchemaFormat;
  compatibility?: string;
  description?: string;
  schemas: {
    key: unknown | null;
    value: unknown | null;
    headers: unknown | null;
  };
};

const SIDES: ChannelSchemaSide[] = ['key', 'value', 'headers'];

function slugify(raw: string): string {
  return (
    (raw || 'channel')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'channel'
  );
}

function schemaExt(format: ChannelSchemaFormat): string {
  if (format === 'avro') return 'avsc';
  if (format === 'protobuf') return 'proto';
  if (format === 'json-schema') return 'schema.json';
  return 'json';
}

function schemaBody(raw: string, side: ChannelSchemaSide, format: ChannelSchemaFormat): string | null {
  if (!raw.trim()) return null;
  const parsed = parseChannelSchema(raw, side, format);
  const source = parsed.source.trim();
  if (!source) return null;
  if (format === 'protobuf') return `${source.replace(/\s+$/, '')}\n`;
  try {
    return `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
  } catch {
    return `${source.replace(/\s+$/, '')}\n`;
  }
}

function schemaJsonValue(
  raw: string,
  side: ChannelSchemaSide,
  format: ChannelSchemaFormat
): unknown | null {
  if (!raw.trim()) return null;
  const parsed = parseChannelSchema(raw, side, format);
  const source = parsed.source.trim();
  if (!source) return null;
  if (format === 'protobuf') {
    return { format: 'protobuf', name: parsed.name || undefined, source };
  }
  try {
    return JSON.parse(source);
  } catch {
    return { format, name: parsed.name || undefined, source };
  }
}

function extrasOf(channel: ChannelElement): ChannelExtras {
  return channel as ChannelExtras;
}

/** Manifest for tooling / re-import later. */
export function buildChannelExportDocument(channel: ChannelElement): ChannelExportDocument {
  const extras = extrasOf(channel);
  const format = normalizeChannelSchemaFormat(extras.schemaFormat);
  const protocol = normalizeChannelProtocol(extras.protocol);
  const compatibility = normalizeChannelCompatibility(extras.compatibility);
  const description = String(channel.description || '').trim() || undefined;

  return {
    kind: 'channel',
    name: channel.name,
    protocol,
    surface: channelSurfaceLabel(protocol),
    schemaFormat: format,
    ...(compatibility ? { compatibility } : {}),
    ...(description ? { description } : {}),
    schemas: {
      key: schemaJsonValue(extras.keySchema || '', 'key', format),
      value: schemaJsonValue(extras.valueSchema || '', 'value', format),
      headers: schemaJsonValue(extras.headersSchema || '', 'headers', format),
    },
  };
}

/** Flat file list: channel.json + one file per populated schema side. */
export function buildChannelExportFiles(channel: ChannelElement): ChannelExportFile[] {
  const extras = extrasOf(channel);
  const format = normalizeChannelSchemaFormat(extras.schemaFormat);
  const slug = slugify(channel.name);
  const files: ChannelExportFile[] = [
    {
      filename: 'channel.json',
      content: `${JSON.stringify(buildChannelExportDocument(channel), null, 2)}\n`,
    },
  ];

  for (const side of SIDES) {
    const raw =
      side === 'key'
        ? extras.keySchema || ''
        : side === 'value'
          ? extras.valueSchema || ''
          : extras.headersSchema || '';
    const body = schemaBody(raw, side, format);
    if (!body) continue;
    const ext = schemaExt(format);
    files.push({
      filename: `${slug}.${side}.${ext}`,
      content: body,
    });
  }

  return files;
}

export function channelExportDownloadName(channel: ChannelElement, files: ChannelExportFile[]): string {
  const slug = slugify(channel.name);
  return files.length <= 1 ? `${slug}-channel.json` : `${slug}-channel.zip`;
}

/** Blob ready for `<a download>` — single file or ZIP. */
export function exportChannelContractBlob(channel: ChannelElement): {
  blob: Blob;
  filename: string;
} {
  const files = buildChannelExportFiles(channel);
  const slug = slugify(channel.name);

  /* Metadata only — no schema bodies yet. */
  if (files.length === 1) {
    return {
      blob: new Blob([files[0].content], { type: 'application/json' }),
      filename: `${slug}-channel.json`,
    };
  }

  /* One schema side + channel.json, or several sides → ZIP. */
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.filename] = strToU8(file.content);
  }
  const zipped = zipSync(entries, { level: 6 });
  return {
    blob: new Blob([new Uint8Array(zipped)], { type: 'application/zip' }),
    filename: `${slug}-channel.zip`,
  };
}

export function downloadChannelContract(channel: ChannelElement): void {
  const { blob, filename } = exportChannelContractBlob(channel);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
