/**
 * gRPC endpoint contracts — protobuf message definitions stored as tagged text.
 *
 *   @name GetUserRequest
 *   @stream unary
 *
 *   message GetUserRequest {
 *     string user_id = 1;
 *   }
 *
 * The `@stream` tag lives on the request side and describes the whole RPC
 * (unary / client / server / bidi). The response side only carries the output
 * message. Validation is a lightweight protobuf syntax check — enough to catch
 * broken braces, bad field numbers and missing messages before Apply.
 */

export const GRPC_STREAM_KINDS = ['unary', 'client', 'server', 'bidi'] as const;

export type GrpcStreamKind = (typeof GRPC_STREAM_KINDS)[number];

export type ProtobufContractSide = 'request' | 'response';

export type ProtobufContract = {
  side: ProtobufContractSide;
  mode: 'protobuf';
  /** Message type name — also the first `message Name` in source when present. */
  name: string;
  /** Protobuf source (typically one `message` block; enums and nested types ok). */
  source: string;
  /** RPC streaming mode — meaningful on the request side. */
  stream: GrpcStreamKind;
};

export type ProtobufMarker = {
  line: number;
  column: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning';
};

export type ProtobufValidation = {
  ok: boolean;
  error?: string;
  warnings: string[];
  markers: ProtobufMarker[];
};

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function emptyContract(side: ProtobufContractSide): ProtobufContract {
  return {
    side,
    mode: 'protobuf',
    name: '',
    source: '',
    stream: 'unary',
  };
}

export function emptyProtobufContract(side: ProtobufContractSide): ProtobufContract {
  return emptyContract(side);
}

export function isGrpcStreamKind(value: string): value is GrpcStreamKind {
  return (GRPC_STREAM_KINDS as readonly string[]).includes(value);
}

/** Pull the first `message Name` declaration out of a proto source. */
export function extractMessageName(source: string): string {
  const match = /(?:^|\n)\s*message\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(source);
  return match?.[1] || '';
}

export function serializeProtobufContract(contract: ProtobufContract): string {
  const lines: string[] = [];
  const name = contract.name.trim() || extractMessageName(contract.source);
  if (name) lines.push(`@name ${name}`);
  if (contract.side === 'request') {
    lines.push(`@stream ${contract.stream || 'unary'}`);
  }
  const source = contract.source.trim();
  if (source) {
    if (lines.length) lines.push('');
    lines.push(source);
  }
  return lines.join('\n').trim();
}

export function parseProtobufContract(
  raw: string,
  side: ProtobufContractSide
): ProtobufContract {
  const contract = emptyContract(side);
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
      if (tag === 'name' && rest) contract.name = rest.split(/\s+/)[0];
      else if (tag === 'stream' && isGrpcStreamKind(rest.toLowerCase())) {
        contract.stream = rest.toLowerCase() as GrpcStreamKind;
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

  if (!contract.name) contract.name = extractMessageName(contract.source);
  return contract;
}

function lineCol(source: string, index: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function markerAt(
  source: string,
  index: number,
  length: number,
  message: string,
  severity: 'error' | 'warning' = 'error'
): ProtobufMarker {
  const { line, column } = lineCol(source, Math.max(0, index));
  return {
    line,
    column,
    endColumn: column + Math.max(1, length),
    message,
    severity,
  };
}

/** Strip // and /* *\/ comments and string literals for structural scans. */
function stripNoise(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < source.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      out += ' ';
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < source.length) {
        out += ' ';
        i += 1;
      }
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

/**
 * Lightweight protobuf syntax check. Not a full compiler — catches the mistakes
 * that make a contract unreadable (broken braces, bad field numbers, missing
 * message) and reports them as Monaco markers.
 */
export function validateProtobufSource(source: string): ProtobufValidation {
  const warnings: string[] = [];
  const markers: ProtobufMarker[] = [];
  const text = String(source || '');

  if (!text.trim()) {
    return { ok: true, warnings, markers };
  }

  const flat = stripNoise(text);

  let depth = 0;
  for (let p = 0; p < flat.length; p++) {
    if (flat[p] === '{') depth += 1;
    else if (flat[p] === '}') {
      depth -= 1;
      if (depth < 0) {
        markers.push(markerAt(text, p, 1, 'Unexpected closing brace'));
        return { ok: false, error: 'Unexpected closing brace', warnings, markers };
      }
    }
  }
  if (depth > 0) {
    markers.push(markerAt(text, text.length, 1, 'Unclosed brace'));
    return { ok: false, error: 'Unclosed brace in protobuf', warnings, markers };
  }

  const messageRe = /\bmessage\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
  const messages: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = messageRe.exec(flat))) {
    messages.push(m[1]);
  }
  if (!messages.length) {
    markers.push(markerAt(text, 0, 1, 'Expected a message declaration', 'error'));
    return {
      ok: false,
      error: 'Expected a message declaration (message Name { … })',
      warnings,
      markers,
    };
  }

  /* Fields: type name = number;  (optional/repeated/required label ok) */
  const fieldRe =
    /\b(?:repeated|optional|required)\s+[\w.]+\s+([A-Za-z_][\w]*)\s*=\s*(\d+)\b|\b(?:map\s*<[^>]+>|[\w.]+)\s+([A-Za-z_][\w]*)\s*=\s*(\d+)\b/g;
  const fieldNumbers = new Map<string, number>();
  const fieldNames = new Set<string>();

  while ((m = fieldRe.exec(flat))) {
    const name = m[1] || m[3];
    const num = Number(m[2] || m[4]);
    const index = m.index + m[0].lastIndexOf(String(num));

    if (!Number.isInteger(num) || num < 1 || num > 536870911) {
      markers.push(
        markerAt(text, index, String(num).length, 'Field number must be between 1 and 536870911')
      );
      return { ok: false, error: 'Invalid field number', warnings, markers };
    }
    if (num >= 19000 && num <= 19999) {
      warnings.push(`Field ${num} is in the protobuf reserved range 19000–19999`);
      markers.push(
        markerAt(text, index, String(num).length, 'Reserved field number range', 'warning')
      );
    }
    if (fieldNumbers.has(String(num))) {
      markers.push(markerAt(text, index, String(num).length, `Duplicate field number ${num}`));
      return { ok: false, error: `Duplicate field number ${num}`, warnings, markers };
    }
    fieldNumbers.set(String(num), index);
    if (name && fieldNames.has(name)) {
      warnings.push(`Duplicate field name: ${name}`);
      markers.push(markerAt(text, m.index, name.length, `Duplicate field name`, 'warning'));
    }
    if (name) fieldNames.add(name);
  }

  /* Enum values: NAME = number; */
  const enumRe = /\b([A-Z][A-Z0-9_]*)\s*=\s*(-?\d+)\b/g;
  while ((m = enumRe.exec(flat))) {
    const num = Number(m[2]);
    if (!Number.isInteger(num)) {
      markers.push(markerAt(text, m.index, m[0].length, 'Invalid enum value'));
      return { ok: false, error: 'Invalid enum value', warnings, markers };
    }
  }

  /* Unknown top-level keyword — soft warning only. */
  const keywordRe = /^\s*([A-Za-z_][\w]*)\b/gm;
  const known = new Set([
    'syntax',
    'import',
    'option',
    'package',
    'message',
    'enum',
    'service',
    'extend',
  ]);
  while ((m = keywordRe.exec(flat))) {
    if (!known.has(m[1]) && m[1] !== 'repeated' && m[1] !== 'optional' && m[1] !== 'required') {
      /* Nested content — skip; only flag at depth 0 is hard. Soft skip. */
    }
  }

  return { ok: true, warnings, markers };
}

export function validateProtobufContract(contract: ProtobufContract): ProtobufValidation {
  const warnings: string[] = [];
  if (!contract.source.trim()) {
    return {
      ok: true,
      warnings: contract.name.trim()
        ? ['Message name is set but the protobuf body is empty']
        : [],
      markers: [],
    };
  }

  const result = validateProtobufSource(contract.source);
  warnings.push(...result.warnings);

  const name = contract.name.trim() || extractMessageName(contract.source);
  if (!name) {
    warnings.push('Message type name is missing');
  } else if (!IDENT_RE.test(name)) {
    return {
      ok: false,
      error: 'Message name must be a valid identifier',
      warnings,
      markers: result.markers,
    };
  }

  if (contract.side === 'request' && !isGrpcStreamKind(contract.stream)) {
    return {
      ok: false,
      error: 'Streaming mode must be unary, client, server, or bidi',
      warnings,
      markers: result.markers,
    };
  }

  return {
    ok: result.ok,
    error: result.error,
    warnings,
    markers: result.markers,
  };
}

export function summarizeProtobufContract(raw: string, emptyLabel: string): string {
  if (!raw.trim()) return emptyLabel;
  const contract = parseProtobufContract(raw, 'request');
  if (!validateProtobufContract(contract).ok) return 'Invalid protobuf';
  const name = contract.name.trim() || extractMessageName(contract.source) || 'message';
  const stream =
    contract.stream && contract.stream !== 'unary' ? ` · ${contract.stream} stream` : '';
  return `${name}${stream}`;
}

export function contractLooksBrokenProtobuf(raw: string): boolean {
  if (!raw.trim()) return false;
  return !validateProtobufContract(parseProtobufContract(raw, 'request')).ok;
}
