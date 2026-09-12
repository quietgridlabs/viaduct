import type { ChannelSchemaFormat } from '@/types/c4Extensions';
import { isJsonishFormat } from '@components/common/ChannelContract';

/** Which read-only viewer renders a contract body; null means plain text. */
export type ContractViewer = 'json' | 'protobuf' | null;

/**
 * Viewer for a channel schema. The format is declared on the contract, so
 * nothing has to be guessed: Avro, JSON Schema and CloudEvents are all JSON
 * documents, protobuf has its own grammar.
 */
export function channelSchemaViewer(format: ChannelSchemaFormat): ContractViewer {
  return isJsonishFormat(format) ? 'json' : 'protobuf';
}

/**
 * Viewer for an endpoint's request / response / headers. These are free text:
 * often a JSON body, sometimes protobuf, frequently a sentence describing what
 * comes back. Returns null when nothing is recognisable rather than defaulting
 * to a language, since highlighting prose invents keywords that are not there.
 */
export function sniffContractViewer(raw: string): ContractViewer {
  const text = raw.trim();
  if (!text) return null;

  if (text.startsWith('{') || text.startsWith('[')) return 'json';
  if (/^\s*syntax\s*=\s*["']proto[23]["']/m.test(text)) return 'protobuf';
  if (/^\s*(message|service)\s+\w+\s*\{/m.test(text)) return 'protobuf';

  return null;
}
