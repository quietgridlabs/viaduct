import { parseJsonContract } from '../JsonContract';

/**
 * Endpoint contracts, shaped after an OpenAPI 3.1 operation but stored as one
 * readable string per side.
 *
 * The storage format is a superset of the tags this project already wrote
 * (`@query` / `@body` / `@status`), so every model saved before this file
 * existed still parses — see `parseHttpContract`.
 *
 *   @query
 *   page: integer = 1        # Page number
 *   limit: integer! = 20     # Required, example 20
 *
 *   @body application/json
 *   { "…": "…" }
 *
 *   @response 404 Not Found
 *   @description Nothing under that id
 *
 * A WebSocket channel has no status codes, so it is described as a list of
 * messages instead — same tags, `@message` in place of `@response`.
 */

/* ── Media types ──────────────────────────────────────────────────────────── */

export const HTTP_MEDIA_KINDS = [
  'none',
  'json',
  'text',
  'form',
  'multipart',
  'xml',
  'binary',
  'ndjson',
] as const;

export type HttpMediaKind = (typeof HTTP_MEDIA_KINDS)[number];

const MEDIA_TYPES: Record<Exclude<HttpMediaKind, 'none'>, string> = {
  json: 'application/json',
  text: 'text/plain',
  form: 'application/x-www-form-urlencoded',
  multipart: 'multipart/form-data',
  xml: 'application/xml',
  binary: 'application/octet-stream',
  ndjson: 'application/x-ndjson',
};

/** Media kinds whose payload is JSON — those get the JSON editor and linting. */
export function isJsonMedia(kind: HttpMediaKind): boolean {
  return kind === 'json' || kind === 'ndjson';
}

export function mediaTypeFor(kind: HttpMediaKind): string | null {
  return kind === 'none' ? null : MEDIA_TYPES[kind];
}

export function mediaKindFromType(raw: string | undefined): HttpMediaKind {
  const ct = (raw || '').trim().toLowerCase();
  if (!ct || ct === 'none') return 'none';
  if (ct.includes('ndjson') || ct.includes('json-seq')) return 'ndjson';
  if (ct.includes('json')) return 'json';
  if (ct.includes('urlencoded')) return 'form';
  if (ct.includes('multipart')) return 'multipart';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('octet-stream') || ct.includes('binary')) return 'binary';
  return 'text';
}

/* ── Parameters ───────────────────────────────────────────────────────────── */

export const HTTP_PARAM_TYPES = [
  'string',
  'integer',
  'number',
  'boolean',
  'array',
  'object',
] as const;

export type HttpParamType = (typeof HTTP_PARAM_TYPES)[number];

/** Where a parameter travels — the OpenAPI `in` field, minus cookies. */
export type HttpParamIn = 'path' | 'query' | 'header';

export type HttpParam = {
  /** Runtime-only, for stable list keys. Never serialized. */
  id: string;
  in: HttpParamIn;
  name: string;
  type: HttpParamType;
  required: boolean;
  description: string;
  example: string;
};

export type HttpBody = {
  media: HttpMediaKind;
  /** Example payload — pretty-printed when the media type is JSON. */
  example: string;
  /** Optional JSON Schema for the payload. */
  schema: string;
};

export type HttpRequestContract = {
  side: 'request';
  mode: 'http';
  params: HttpParam[];
  body: HttpBody;
};

export type HttpResponseItem = {
  id: string;
  status: number;
  /** What this reply means — the OpenAPI response description. */
  description: string;
  headers: HttpParam[];
  body: HttpBody;
};

export type HttpResponseContract = {
  side: 'response';
  mode: 'http';
  responses: HttpResponseItem[];
};

export type HttpMessage = {
  id: string;
  name: string;
  description: string;
  body: HttpBody;
};

/** WebSocket channels carry messages in both directions, never status codes. */
export type HttpChannelContract = {
  side: 'request' | 'response';
  mode: 'channel';
  messages: HttpMessage[];
};

export type HttpContract =
  | HttpRequestContract
  | HttpResponseContract
  | HttpChannelContract;

export type HttpContractSide = 'request' | 'response';

export type HttpContractValidation = {
  ok: boolean;
  /** Blocks Apply. */
  error?: string;
  /** Worth fixing, but the contract still saves. */
  warnings: string[];
};

/* ── Status codes ─────────────────────────────────────────────────────────── */

const STATUS_TEXTS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const COMMON_STATUS_CODES = Object.keys(STATUS_TEXTS).map(Number);

/** The handful worth a one-click button; the rest live in the dropdown. */
export const QUICK_STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 500];

export function statusTextFor(code: number, fallback = ''): string {
  return STATUS_TEXTS[code] || fallback;
}

/** 2xx / 4xx / 5xx — drives the colour of the status chip. */
export function statusClass(code: number): 'success' | 'redirect' | 'client' | 'server' | 'info' {
  if (code >= 500) return 'server';
  if (code >= 400) return 'client';
  if (code >= 300) return 'redirect';
  if (code >= 200) return 'success';
  return 'info';
}

/* ── Construction helpers ─────────────────────────────────────────────────── */

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export function emptyBody(): HttpBody {
  return { media: 'none', example: '', schema: '' };
}

export function newParam(where: HttpParamIn, patch: Partial<HttpParam> = {}): HttpParam {
  return {
    id: uid('prm'),
    in: where,
    name: '',
    type: 'string',
    required: where === 'path',
    description: '',
    example: '',
    ...patch,
  };
}

export function newResponse(status = 200, patch: Partial<HttpResponseItem> = {}): HttpResponseItem {
  return {
    id: uid('res'),
    status,
    description: '',
    headers: [],
    body: emptyBody(),
    ...patch,
  };
}

export function newMessage(patch: Partial<HttpMessage> = {}): HttpMessage {
  return { id: uid('msg'), name: '', description: '', body: emptyBody(), ...patch };
}

export function emptyRequest(): HttpRequestContract {
  return { side: 'request', mode: 'http', params: [], body: emptyBody() };
}

export function emptyResponse(): HttpResponseContract {
  return { side: 'response', mode: 'http', responses: [newResponse(200)] };
}

export function emptyChannel(side: HttpContractSide): HttpChannelContract {
  return { side, mode: 'channel', messages: [] };
}

/* ── Path parameters ──────────────────────────────────────────────────────── */

/**
 * Names in the path itself — `/users/:id`, `/users/{id}` and `/users/<id>` are
 * all in the wild, so all three are read.
 */
export function derivePathParams(path: string): string[] {
  const names: string[] = [];
  const re = /:([A-Za-z0-9_]+)|\{([A-Za-z0-9_]+)\}|<([A-Za-z0-9_]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path || ''))) {
    const name = match[1] || match[2] || match[3];
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Adds the path's parameters that the contract is missing, keeping the rest. */
export function syncPathParams(params: HttpParam[], path: string): HttpParam[] {
  const wanted = derivePathParams(path);
  if (!wanted.length) return params;
  const have = new Set(
    params.filter((p) => p.in === 'path').map((p) => p.name.trim().toLowerCase())
  );
  const added = wanted
    .filter((name) => !have.has(name.toLowerCase()))
    .map((name) => newParam('path', { name, required: true }));
  if (!added.length) return params;
  /* Path parameters read best first — they are part of the URL. */
  return [...params.filter((p) => p.in === 'path'), ...added, ...params.filter((p) => p.in !== 'path')];
}

/* ── Serialization ────────────────────────────────────────────────────────── */

function formatJson(raw: string): string {
  const parsed = parseJsonContract(raw);
  return parsed.ok && !parsed.empty ? parsed.formatted : raw.trim();
}

function serializeParam(p: HttpParam): string {
  const name = p.name.trim();
  const head = `${name}: ${p.type}${p.required ? '!' : ''}`;
  const example = p.example.trim() ? ` = ${p.example.trim()}` : '';
  const description = p.description.trim() ? `  # ${p.description.trim()}` : '';
  return `${head}${example}${description}`;
}

function serializeParamBlock(tag: string, params: HttpParam[]): string[] {
  const rows = params.filter((p) => p.name.trim());
  if (!rows.length) return [];
  return [`@${tag}`, ...rows.map(serializeParam)];
}

function serializeBody(body: HttpBody): string[] {
  const out: string[] = [];
  if (body.media === 'none') return out;
  const media = mediaTypeFor(body.media) || 'text/plain';
  const example = isJsonMedia(body.media) ? formatJson(body.example) : body.example.trim();
  if (example) {
    out.push(`@body ${media}`, example);
  }
  const schema = formatJson(body.schema);
  if (schema) out.push('@schema', schema);
  /* A media type with nothing under it is still information: it says the call
     carries a payload of that shape even though nobody wrote the example. */
  if (!out.length) out.push(`@body ${media}`);
  return out;
}

function joinBlocks(blocks: string[][]): string {
  return blocks
    .filter((block) => block.length)
    .map((block) => block.join('\n'))
    .join('\n\n');
}

export function serializeHttpContract(contract: HttpContract): string {
  if (contract.mode === 'channel') {
    const messages = contract.messages.filter(
      (m) => m.name.trim() || m.body.media !== 'none' || m.description.trim()
    );
    if (!messages.length) return '';
    return joinBlocks(
      messages.map((m) => [
        `@message ${m.name.trim() || 'message'}`,
        ...(m.description.trim() ? [`@description ${m.description.trim()}`] : []),
        ...serializeBody(m.body),
      ])
    );
  }

  if (contract.side === 'request') {
    const blocks = [
      serializeParamBlock('path', contract.params.filter((p) => p.in === 'path')),
      serializeParamBlock('query', contract.params.filter((p) => p.in === 'query')),
      serializeParamBlock('header', contract.params.filter((p) => p.in === 'header')),
      serializeBody(contract.body),
    ];
    return joinBlocks(blocks);
  }

  const responses = [...contract.responses].sort((a, b) => a.status - b.status);
  if (!responses.length) return '';
  return joinBlocks(
    responses.map((r) => [
      `@response ${r.status} ${statusTextFor(r.status, '')}`.trim(),
      ...(r.description.trim() ? [`@description ${r.description.trim()}`] : []),
      ...serializeParamBlock('header', r.headers),
      ...serializeBody(r.body),
    ])
  );
}

/* ── Parsing ──────────────────────────────────────────────────────────────── */

type Section = { tag: string; arg: string; body: string };

const TAG_RE = /^@(path|query|header|body|schema|status|response|message|description)\b(.*)$/i;

/** Same tags, but asked of a whole document rather than a single line. */
const HAS_TAG_RE = /^@(path|query|header|body|schema|status|response|message|description)\b/im;

function parseSections(raw: string): Section[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const sections: Section[] = [];
  let current: { tag: string; arg: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const body = [...current.lines];
    if (body[0] === '') body.shift();
    while (body.length && body[body.length - 1] === '') body.pop();
    sections.push({ tag: current.tag, arg: current.arg, body: body.join('\n') });
    current = null;
  };

  for (const line of lines) {
    const match = line.match(TAG_RE);
    if (match) {
      flush();
      current = { tag: match[1].toLowerCase(), arg: match[2].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return sections;
}

/**
 * One parameter per line:
 *
 *   name: type! = example  # description
 *
 * Everything after the name is optional, which is what keeps the pre-existing
 * `name=value` query lines readable — they parse as a string with an example.
 */
export function parseParamLine(line: string, where: HttpParamIn): HttpParam | null {
  let rest = line.trim();
  if (!rest || rest.startsWith('#')) return null;

  let description = '';
  const withComment = rest.match(/^([\s\S]*?)\s+#\s?(.*)$/);
  if (withComment) {
    rest = withComment[1].trim();
    description = withComment[2].trim();
  }

  let example = '';
  const withExample = rest.match(/^(.*?)\s*=\s*([\s\S]*)$/);
  if (withExample) {
    rest = withExample[1].trim();
    example = withExample[2].trim();
  }

  let required = where === 'path';
  if (rest.endsWith('!')) {
    required = true;
    rest = rest.slice(0, -1).trim();
  }

  const colon = rest.indexOf(':');
  const name = (colon < 0 ? rest : rest.slice(0, colon)).trim();
  if (!name) return null;
  const rawType = colon < 0 ? '' : rest.slice(colon + 1).trim().toLowerCase();
  const type = (HTTP_PARAM_TYPES as readonly string[]).includes(rawType)
    ? (rawType as HttpParamType)
    : 'string';

  return { id: uid('prm'), in: where, name, type, required, description, example };
}

function parseParamBlock(block: string, where: HttpParamIn): HttpParam[] {
  return block
    .split('\n')
    .map((line) => parseParamLine(line, where))
    .filter((p): p is HttpParam => p !== null);
}

function applyBodySection(body: HttpBody, section: Section) {
  if (section.tag === 'body') {
    body.media = mediaKindFromType(section.arg);
    body.example = isJsonMedia(body.media) ? formatJson(section.body) : section.body;
    /* `@body application/json` with nothing under it still declares the type. */
    if (body.media === 'none' && section.body.trim()) body.media = 'text';
  }
  if (section.tag === 'schema') {
    body.schema = formatJson(section.body || section.arg);
    if (body.media === 'none' && body.schema) body.media = 'json';
  }
}

function parseStatusArg(arg: string): { status: number; reason: string } {
  const match = arg.match(/^(\d{3})\s*(.*)$/);
  if (!match) return { status: 200, reason: '' };
  return { status: Number(match[1]), reason: match[2].trim() };
}

/** Legacy / free-form / tagged text → structured contract. */
export function parseHttpContract(
  raw: string,
  side: HttpContractSide,
  opts: { channel?: boolean } = {}
): HttpContract {
  const trimmed = (raw || '').trim();
  const channel = opts.channel || /^@message\b/m.test(trimmed);

  if (!trimmed) {
    if (channel) return emptyChannel(side);
    return side === 'request' ? emptyRequest() : emptyResponse();
  }

  if (HAS_TAG_RE.test(trimmed)) {
    const sections = parseSections(trimmed);
    if (channel) return parseChannelSections(sections, side, trimmed);
    return side === 'request'
      ? parseRequestSections(sections)
      : parseResponseSections(sections);
  }

  /* Plain JSON blob — how contracts looked before there were any tags. */
  const json = parseJsonContract(trimmed);
  if (json.ok && !json.empty) {
    const body: HttpBody = { media: 'json', example: json.formatted, schema: '' };
    if (channel) {
      return { side, mode: 'channel', messages: [newMessage({ body })] };
    }
    if (side === 'request') return { ...emptyRequest(), body };
    return { side: 'response', mode: 'http', responses: [newResponse(200, { body })] };
  }

  /* "200 OK" / "404 Not Found" with an optional trailing body. */
  if (side === 'response' && !channel) {
    const statusMatch = trimmed.match(/^(\d{3})\s*([^\n]*)(?:\n+([\s\S]*))?$/);
    if (statusMatch) {
      const status = Number(statusMatch[1]);
      const reason = statusMatch[2].trim();
      const rest = (statusMatch[3] || '').trim();
      const restJson = parseJsonContract(rest);
      const body: HttpBody = !rest
        ? emptyBody()
        : restJson.ok && !restJson.empty
          ? { media: 'json', example: restJson.formatted, schema: '' }
          : { media: 'text', example: rest, schema: '' };
      return {
        side: 'response',
        mode: 'http',
        responses: [
          newResponse(status, { body, description: reasonAsDescription(status, reason) }),
        ],
      };
    }
  }

  const body: HttpBody = { media: 'text', example: trimmed, schema: '' };
  if (channel) return { side, mode: 'channel', messages: [newMessage({ body })] };
  if (side === 'request') return { ...emptyRequest(), body };
  return { side: 'response', mode: 'http', responses: [newResponse(200, { body })] };
}

/**
 * The reason phrase is fixed per status code, so a custom one carried meaning
 * the author typed by hand — it becomes the description rather than vanishing.
 */
function reasonAsDescription(status: number, reason: string): string {
  if (!reason) return '';
  return reason.toLowerCase() === statusTextFor(status).toLowerCase() ? '' : reason;
}

function parseRequestSections(sections: Section[]): HttpRequestContract {
  const contract = emptyRequest();
  for (const section of sections) {
    if (section.tag === 'path' || section.tag === 'query' || section.tag === 'header') {
      contract.params.push(...parseParamBlock(section.body || section.arg, section.tag));
    }
    if (section.tag === 'body' || section.tag === 'schema') {
      applyBodySection(contract.body, section);
    }
  }
  return contract;
}

function parseResponseSections(sections: Section[]): HttpResponseContract {
  const responses: HttpResponseItem[] = [];
  let current: HttpResponseItem | null = null;

  const ensure = () => {
    if (!current) {
      current = newResponse(200);
      responses.push(current);
    }
    return current;
  };

  for (const section of sections) {
    if (section.tag === 'response' || section.tag === 'status') {
      const { status, reason } = parseStatusArg(section.arg);
      current = newResponse(status, { description: reasonAsDescription(status, reason) });
      responses.push(current);
      continue;
    }
    const target = ensure();
    if (section.tag === 'description') {
      target.description = (section.arg || section.body).trim();
    }
    if (section.tag === 'header') {
      target.headers.push(...parseParamBlock(section.body || section.arg, 'header'));
    }
    if (section.tag === 'body' || section.tag === 'schema') {
      applyBodySection(target.body, section);
    }
  }

  return {
    side: 'response',
    mode: 'http',
    responses: responses.length ? responses : [newResponse(200)],
  };
}

function parseChannelSections(
  sections: Section[],
  side: HttpContractSide,
  raw: string
): HttpChannelContract {
  const messages: HttpMessage[] = [];
  let current: HttpMessage | null = null;

  const ensure = () => {
    if (!current) {
      current = newMessage();
      messages.push(current);
    }
    return current;
  };

  for (const section of sections) {
    /* An HTTP-shaped contract retyped as a channel keeps its payload: the
       status line becomes the message name, the body it carried survives. */
    if (section.tag === 'message' || section.tag === 'status' || section.tag === 'response') {
      current = newMessage({ name: section.arg.trim() });
      messages.push(current);
      continue;
    }
    const target = ensure();
    if (section.tag === 'description') {
      target.description = (section.arg || section.body).trim();
    }
    if (section.tag === 'body' || section.tag === 'schema') {
      applyBodySection(target.body, section);
    }
  }

  if (!messages.length && raw.trim()) {
    messages.push(newMessage({ body: { media: 'text', example: raw.trim(), schema: '' } }));
  }
  return { side, mode: 'channel', messages };
}

/* ── Validation ───────────────────────────────────────────────────────────── */

function duplicateNames(params: HttpParam[]): string[] {
  const seen = new Map<string, number>();
  for (const p of params) {
    const key = `${p.in}:${p.name.trim().toLowerCase()}`;
    if (!p.name.trim()) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([key]) => key.split(':')[1]);
}

function validateBody(body: HttpBody, where: string): string | null {
  if (isJsonMedia(body.media) && body.example.trim()) {
    const json = parseJsonContract(body.example);
    if (!json.ok) return `${where}: ${json.error}`;
  }
  if (body.schema.trim()) {
    const schema = parseJsonContract(body.schema);
    if (!schema.ok) return `${where} schema: ${schema.error}`;
    if (schema.ok && !schema.empty && (typeof schema.value !== 'object' || Array.isArray(schema.value))) {
      return `${where} schema: JSON Schema must be an object`;
    }
  }
  return null;
}

export function validateHttpContract(
  contract: HttpContract,
  opts: { path?: string } = {}
): HttpContractValidation {
  const warnings: string[] = [];

  if (contract.mode === 'channel') {
    for (const message of contract.messages) {
      const error = validateBody(message.body, `Message "${message.name || '…'}"`);
      if (error) return { ok: false, error, warnings };
      if (!message.name.trim()) warnings.push('A message has no name');
    }
    return { ok: true, warnings };
  }

  if (contract.side === 'request') {
    for (const p of contract.params) {
      if (!p.name.trim() && (p.example.trim() || p.description.trim())) {
        return { ok: false, error: 'A parameter row has no name', warnings };
      }
    }
    for (const name of duplicateNames(contract.params)) {
      return { ok: false, error: `Duplicate parameter: ${name}`, warnings };
    }
    const error = validateBody(contract.body, 'Body');
    if (error) return { ok: false, error, warnings };

    if (opts.path) {
      const inPath = derivePathParams(opts.path).map((n) => n.toLowerCase());
      const declared = contract.params
        .filter((p) => p.in === 'path' && p.name.trim())
        .map((p) => p.name.trim().toLowerCase());
      for (const name of inPath) {
        if (!declared.includes(name)) warnings.push(`Path parameter "${name}" is not described`);
      }
      for (const name of declared) {
        if (!inPath.includes(name)) warnings.push(`"${name}" is not in the path`);
      }
    }
    if (contract.body.media !== 'none' && !contract.body.example.trim() && !contract.body.schema.trim()) {
      warnings.push('Body has a media type but no example or schema');
    }
    return { ok: true, warnings };
  }

  if (!contract.responses.length) {
    return { ok: false, error: 'Describe at least one response', warnings };
  }
  const codes = new Set<number>();
  for (const r of contract.responses) {
    if (!Number.isInteger(r.status) || r.status < 100 || r.status > 599) {
      return { ok: false, error: 'Status must be an HTTP code between 100 and 599', warnings };
    }
    if (codes.has(r.status)) {
      return { ok: false, error: `Status ${r.status} is described twice`, warnings };
    }
    codes.add(r.status);
    for (const name of duplicateNames(r.headers)) {
      return { ok: false, error: `Duplicate header: ${name}`, warnings };
    }
    const error = validateBody(r.body, `${r.status} body`);
    if (error) return { ok: false, error, warnings };
    if (r.status === 204 && r.body.media !== 'none') {
      warnings.push('204 No Content should not carry a body');
    }
    if (r.body.media !== 'none' && !r.body.example.trim() && !r.body.schema.trim()) {
      warnings.push(`${r.status} has a media type but no example or schema`);
    }
  }
  if (!contract.responses.some((r) => r.status < 400)) {
    warnings.push('No success response is described');
  }
  return { ok: true, warnings };
}

/* ── Field preview ────────────────────────────────────────────────────────── */

const MEDIA_LABELS: Record<HttpMediaKind, string> = {
  none: '',
  json: 'JSON',
  text: 'Text',
  form: 'Form',
  multipart: 'Multipart',
  xml: 'XML',
  binary: 'Binary',
  ndjson: 'NDJSON',
};

export function summarizeHttpContract(
  raw: string,
  side: HttpContractSide,
  emptyLabel: string,
  opts: { channel?: boolean } = {}
): string {
  if (!raw.trim()) return emptyLabel;
  const contract = parseHttpContract(raw, side, opts);

  if (contract.mode === 'channel') {
    const names = contract.messages.map((m) => m.name.trim()).filter(Boolean);
    if (!names.length) {
      const count = contract.messages.length;
      return count === 1 ? '1 message' : `${count} messages`;
    }
    return names.slice(0, 3).join(', ') + (names.length > 3 ? ' …' : '');
  }

  if (contract.side === 'request') {
    const bits: string[] = [];
    const named = (where: HttpParamIn) =>
      contract.params.filter((p) => p.in === where && p.name.trim()).map((p) => p.name.trim());
    const path = named('path');
    const query = named('query');
    const headers = named('header');
    if (path.length) bits.push(`Path: ${path.slice(0, 3).join(', ')}${path.length > 3 ? '…' : ''}`);
    if (query.length) bits.push(`Query: ${query.slice(0, 3).join(', ')}${query.length > 3 ? '…' : ''}`);
    if (headers.length) bits.push(`${headers.length} header${headers.length > 1 ? 's' : ''}`);
    if (contract.body.media !== 'none') bits.push(`${MEDIA_LABELS[contract.body.media]} body`);
    return bits.join(' · ') || emptyLabel;
  }

  const responses = [...contract.responses].sort((a, b) => a.status - b.status);
  if (!responses.length) return emptyLabel;
  if (responses.length === 1) {
    const only = responses[0];
    const status = `${only.status} ${statusTextFor(only.status)}`.trim();
    const media = MEDIA_LABELS[only.body.media];
    return media ? `${status} · ${media}` : status;
  }
  return responses.map((r) => String(r.status)).join(' · ');
}

export function contractLooksBroken(
  raw: string,
  side: HttpContractSide,
  opts: { channel?: boolean } = {}
): boolean {
  if (!raw.trim()) return false;
  return !validateHttpContract(parseHttpContract(raw, side, opts)).ok;
}
