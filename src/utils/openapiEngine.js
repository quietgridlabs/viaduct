/**
 * Model ⇄ OpenAPI conversion.
 *
 * A container is a service, and a service's contract is an OpenAPI document:
 * every endpoint element on the canvas is the view of one `paths[path][method]`
 * operation. This module owns that mapping in both directions — building a
 * document out of the endpoints the client is looking at, and taking an
 * imported document apart into endpoints the canvas can show.
 *
 * It is a pure function of its payload, like the image export in
 * `renderRoutes.js`: nothing is read from the database, so guests working in
 * the local editor get the same conversion as anyone else.
 *
 * The wire shape for a contract is the editor's own structured form
 * (parameters, body, responses) rather than its stored text, so the text format
 * stays entirely in the client that edits it and OpenAPI stays entirely here.
 *
 * Community edition: runs in the browser (no /api/openapi). YAML import and
 * full $ref dereference need @scalar/openapi-parser — here we accept JSON and
 * leave refs unresolved, which is enough for canvas endpoints and typical
 * imported JSON specs.
 */

export const OPENAPI_VERSION = '3.1.0';

const HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const PARAM_TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object'];
const WEBSOCKET_METHODS = ['WS', 'WSS'];
const GRPC_METHODS = ['GRPC'];

const MEDIA_TYPES = {
  json: 'application/json',
  text: 'text/plain',
  form: 'application/x-www-form-urlencoded',
  multipart: 'multipart/form-data',
  xml: 'application/xml',
  binary: 'application/octet-stream',
  ndjson: 'application/x-ndjson',
};

const STATUS_TEXTS = {
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

/* ── Small helpers ────────────────────────────────────────────────────────── */

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function tryParse(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function statusTextFor(code) {
  return STATUS_TEXTS[code] || '';
}

function mediaTypeFor(kind) {
  return kind && kind !== 'none' ? MEDIA_TYPES[kind] || null : null;
}

function mediaKindFromType(raw) {
  const ct = String(raw || '').trim().toLowerCase();
  if (!ct || ct === 'none') return 'none';
  if (ct.includes('ndjson') || ct.includes('json-seq')) return 'ndjson';
  if (ct.includes('json')) return 'json';
  if (ct.includes('urlencoded')) return 'form';
  if (ct.includes('multipart')) return 'multipart';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('octet-stream') || ct.includes('binary')) return 'binary';
  return 'text';
}

function isJsonMedia(kind) {
  return kind === 'json' || kind === 'ndjson';
}

export function isWebSocketMethod(method) {
  return WEBSOCKET_METHODS.includes(String(method || '').trim().toUpperCase());
}

export function isGrpcMethod(method) {
  return GRPC_METHODS.includes(String(method || '').trim().toUpperCase());
}

/** `/users/:id` → `/users/{id}` — OpenAPI only knows the braces form. */
export function toOpenApiPath(path) {
  const trimmed = String(path || '/').trim() || '/';
  const braced = trimmed
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/<([A-Za-z0-9_]+)>/g, '{$1}');
  return braced.startsWith('/') ? braced : `/${braced}`;
}

function methodKey(method) {
  return String(method || 'GET').trim().toLowerCase();
}

/** A typed example reads better as a real JSON value than a quoted string. */
function exampleValue(raw, type) {
  const value = String(raw || '').trim();
  if (!value) return undefined;
  if (type === 'integer' || type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (type === 'boolean') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }
  if (type === 'array' || type === 'object') {
    const parsed = tryParse(value);
    return parsed === undefined ? value : parsed;
  }
  return value;
}

/* ── Parameters ───────────────────────────────────────────────────────────── */

function parameterFrom(param) {
  const name = String(param?.name || '').trim();
  const where = param?.in === 'path' || param?.in === 'header' ? param.in : 'query';
  const type = PARAM_TYPES.includes(param?.type) ? param.type : 'string';
  const out = {
    name,
    in: where,
    required: where === 'path' ? true : Boolean(param?.required),
    schema: { type },
  };
  const description = String(param?.description || '').trim();
  if (description) out.description = description;
  const example = exampleValue(param?.example, type);
  if (example !== undefined) out.example = example;
  return out;
}

function parameterTo(raw, fallbackIn) {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const where =
    raw.in === 'path' || raw.in === 'header' || raw.in === 'query' ? raw.in : fallbackIn || 'query';
  const schema = isRecord(raw.schema) ? raw.schema : {};
  const type = PARAM_TYPES.includes(schema.type) ? schema.type : 'string';
  return {
    in: where,
    name,
    type,
    required: Boolean(raw.required) || where === 'path',
    description: typeof raw.description === 'string' ? raw.description : '',
    example: text(raw.example !== undefined ? raw.example : schema.example),
  };
}

/** The endpoint's free-text `headers` box, as header parameters. */
function headersFromText(raw, taken) {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(':');
      const name = (colon < 0 ? line : line.slice(0, colon)).trim();
      const example = colon < 0 ? '' : line.slice(colon + 1).trim();
      return { in: 'header', name, type: 'string', required: false, description: '', example };
    })
    .filter(
      (header) =>
        header.name && !taken.some((t) => String(t).toLowerCase() === header.name.toLowerCase())
    );
}

/* ── Bodies ───────────────────────────────────────────────────────────────── */

function contentFrom(body) {
  const media = mediaTypeFor(body?.media);
  if (!media) return undefined;
  const entry = {};
  const schema = tryParse(body?.schema);
  if (schema !== undefined) entry.schema = schema;
  const example = String(body?.example || '').trim();
  if (example) {
    const parsed = isJsonMedia(body.media) ? tryParse(example) : undefined;
    entry.example = parsed === undefined ? example : parsed;
  }
  return { [media]: entry };
}

/**
 * `content` is read from the resolved document so the media type and example
 * are whatever the pointer led to; the schema text is taken from `rawContent`
 * when there is one, so a `$ref` is stored as the ref it was written as.
 */
function contentTo(content, rawContent) {
  const empty = { media: 'none', example: '', schema: '' };
  if (!isRecord(content)) return empty;
  const [media, entry] = Object.entries(content)[0] || [];
  if (!media) return empty;
  const body = { media: mediaKindFromType(media), example: '', schema: '' };
  const rawEntry = isRecord(rawContent) ? rawContent[media] : undefined;
  const rawSchema = isRecord(rawEntry) ? rawEntry.schema : undefined;
  if (isRecord(entry)) {
    if (entry.schema !== undefined) {
      body.schema = text(rawSchema !== undefined ? rawSchema : entry.schema);
    }
    let example = entry.example;
    if (example === undefined && isRecord(entry.examples)) {
      const first = Object.values(entry.examples)[0];
      example = isRecord(first) ? first.value : undefined;
    }
    if (example !== undefined) body.example = text(example);
  }
  return body;
}

/* ── Operation ⇄ contract ─────────────────────────────────────────────────── */

function operationIdFor(name, method, path) {
  const fromName = String(name || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word, i) => (i ? word.charAt(0).toUpperCase() + word.slice(1) : word.toLowerCase()))
    .join('');
  if (fromName) return fromName;
  return `${methodKey(method)}${toOpenApiPath(path).replace(/[^A-Za-z0-9]+/g, '_')}`;
}

/**
 * One endpoint (with its contract in the editor's structured form) → the
 * OpenAPI operation it stands for.
 */
export function operationFromEndpoint(endpoint) {
  const path = endpoint?.path || endpoint?.endpoint || '/';
  const method = endpoint?.method || 'GET';
  const request = isRecord(endpoint?.request) ? endpoint.request : {};
  const response = isRecord(endpoint?.response) ? endpoint.response : {};

  const operation = { operationId: operationIdFor(endpoint?.name, method, path) };
  const summary = String(endpoint?.name || '').trim();
  if (summary) operation.summary = summary;
  const description = String(endpoint?.description || '').trim();
  if (description) operation.description = description;

  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags.filter(Boolean) : [];
  if (!tags.length && String(endpoint?.group || '').trim()) tags.push(endpoint.group.trim());
  if (tags.length) operation.tags = tags;

  const declared = Array.isArray(request.params)
    ? request.params.filter((p) => String(p?.name || '').trim())
    : [];
  const params = [
    ...declared,
    ...headersFromText(
      endpoint?.headers,
      declared.filter((p) => p.in === 'header').map((p) => p.name)
    ),
  ];
  if (params.length) operation.parameters = params.map(parameterFrom);

  const requestContent = contentFrom(request.body);
  if (requestContent) operation.requestBody = { required: true, content: requestContent };

  const responses = {};
  const items = Array.isArray(response.responses) ? response.responses : [];
  for (const item of items) {
    const status = Number(item?.status);
    if (!Number.isInteger(status)) continue;
    const entry = {
      description:
        String(item?.description || '').trim() || statusTextFor(status) || `Status ${status}`,
    };
    const headers = Array.isArray(item?.headers)
      ? item.headers.filter((h) => String(h?.name || '').trim())
      : [];
    if (headers.length) {
      entry.headers = Object.fromEntries(
        headers.map((header) => {
          /* A header object is a parameter without its name and location. */
          const { name, in: _in, ...rest } = parameterFrom(header);
          return [name, rest];
        })
      );
    }
    const content = contentFrom(item?.body);
    if (content) entry.content = content;
    responses[String(status)] = entry;
  }
  operation.responses = Object.keys(responses).length
    ? responses
    : { default: { description: 'Response' } };

  return operation;
}

/** OpenAPI operation → the contract in the editor's structured form. */
/**
 * `operation` comes from the resolved document and `rawOperation` from the one
 * as written. Structure — parameters, status codes, headers — is read from the
 * resolved side, because a `$ref`'d parameter has no name to show until it is
 * followed; schema text comes from the raw side, so the ref survives the trip.
 */
export function contractsFromOperation(operation, rawOperation) {
  const op = isRecord(operation) ? operation : {};
  const rawOp = isRecord(rawOperation) ? rawOperation : op;

  const parameters = Array.isArray(op.parameters) ? op.parameters : [];
  const request = {
    side: 'request',
    mode: 'http',
    params: parameters.map((p) => parameterTo(p)).filter(Boolean),
    body: isRecord(op.requestBody)
      ? contentTo(op.requestBody.content, isRecord(rawOp.requestBody) ? rawOp.requestBody.content : undefined)
      : { media: 'none', example: '', schema: '' },
  };

  const responses = [];
  const raw = isRecord(op.responses) ? op.responses : {};
  const rawResponses = isRecord(rawOp.responses) ? rawOp.responses : {};
  for (const [code, value] of Object.entries(raw)) {
    const status = Number(code);
    if (!Number.isInteger(status)) continue;
    const entry = isRecord(value) ? value : {};
    const description = typeof entry.description === 'string' ? entry.description : '';
    const headers = isRecord(entry.headers)
      ? Object.entries(entry.headers)
          .map(([name, header]) =>
            parameterTo({ ...(isRecord(header) ? header : {}), name, in: 'header' }, 'header')
          )
          .filter(Boolean)
      : [];
    responses.push({
      status,
      /* OpenAPI demands a description and most specs just echo the reason
         phrase there — no point storing it twice. */
      description:
        description.toLowerCase() === statusTextFor(status).toLowerCase() ? '' : description,
      headers,
      body: contentTo(
        entry.content,
        isRecord(rawResponses[code]) ? rawResponses[code].content : undefined
      ),
    });
  }
  if (!responses.length) responses.push({ status: 200, description: '', headers: [], body: { media: 'none', example: '', schema: '' } });

  return {
    request,
    response: { side: 'response', mode: 'http', responses },
  };
}

/* ── Channels ─────────────────────────────────────────────────────────────── */

function channelFrom(contract, protocol, direction) {
  const messages = Array.isArray(contract?.messages) ? contract.messages : [];
  return {
    direction,
    protocol: String(protocol || 'WS').toUpperCase(),
    messages: messages.map((message) => {
      const entry = {};
      const name = String(message?.name || '').trim();
      if (name) entry.name = name;
      const description = String(message?.description || '').trim();
      if (description) entry.description = description;
      const content = contentFrom(message?.body);
      if (content) entry.content = content;
      return entry;
    }),
  };
}

function channelTo(channel) {
  const messages = Array.isArray(channel?.messages) ? channel.messages : [];
  return {
    mode: 'channel',
    messages: messages.map((message) => ({
      name: typeof message?.name === 'string' ? message.name : '',
      description: typeof message?.description === 'string' ? message.description : '',
      body: contentTo(message?.content),
    })),
  };
}

/* ── gRPC ─────────────────────────────────────────────────────────────────── */

function grpcFrom(endpoint) {
  const request = isRecord(endpoint?.request) ? endpoint.request : {};
  const response = isRecord(endpoint?.response) ? endpoint.response : {};
  return {
    protocol: 'GRPC',
    streaming: String(request.stream || 'unary'),
    request: {
      name: String(request.name || ''),
      proto: String(request.source || ''),
    },
    response: {
      name: String(response.name || ''),
      proto: String(response.source || ''),
    },
  };
}

function grpcTo(entry) {
  const request = isRecord(entry?.request) ? entry.request : {};
  const response = isRecord(entry?.response) ? entry.response : {};
  return {
    request: {
      side: 'request',
      mode: 'protobuf',
      name: String(request.name || ''),
      source: String(request.proto || ''),
      stream: String(entry?.streaming || 'unary'),
    },
    response: {
      side: 'response',
      mode: 'protobuf',
      name: String(response.name || ''),
      source: String(response.proto || ''),
      stream: 'unary',
    },
  };
}

/* ── Documents ────────────────────────────────────────────────────────────── */

function emptyDocument(meta) {
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: String(meta?.title || 'Service'),
      version: String(meta?.version || '1.0.0'),
      ...(meta?.description ? { description: String(meta.description) } : {}),
    },
    paths: {},
  };
}

export function parseServiceDocument(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, error: 'Empty document' };
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Not JSON' };
    }
  }
  if (!isRecord(parsed)) return { ok: false, error: 'Document must be a JSON object' };
  if (typeof parsed.openapi !== 'string' && typeof parsed.swagger !== 'string') {
    return { ok: false, error: 'Not an OpenAPI document — no "openapi" or "swagger" field' };
  }
  if (!isRecord(parsed.paths) && !isRecord(parsed['x-channels']) && !isRecord(parsed['x-grpc'])) {
    return { ok: false, error: 'Document has no paths' };
  }
  return {
    ok: true,
    doc: {
      ...parsed,
      openapi: typeof parsed.openapi === 'string' ? parsed.openapi : OPENAPI_VERSION,
      info: isRecord(parsed.info) ? parsed.info : { title: 'Service', version: '1.0.0' },
      paths: isRecord(parsed.paths) ? parsed.paths : {},
    },
  };
}

/* ── $ref resolution ──────────────────────────────────────────────────────── */

function pointerFor(path) {
  const escaped = path.map((p) => String(p).replace(/~/g, '~0').replace(/\//g, '~1'));
  return `#/${escaped.join('/')}`;
}

/**
 * A dereferenced document is a graph, not a tree: a schema that refers to
 * itself resolves to an object containing itself, and `JSON.stringify` throws
 * on that.
 *
 * The repeat shows up on the shared node — the `properties` map, not the schema
 * that owns it — so the cut is reported upwards and made at the owner. Writing
 * the pointer where the repeat is found would leave `properties: { $ref }`,
 * which reads as a property actually named `$ref`; writing it at the owner
 * leaves `child: { $ref }`, which is what the spec said in the first place.
 */
const CYCLE = Symbol('cycle');

function decycle(node, ancestors, path) {
  if (!node || typeof node !== 'object') return node;

  const repeats = ancestors.get(node);
  if (repeats !== undefined) {
    /* Cut at whatever owns the repeated node, not at the node itself. The
       marker is a symbol so a schema with a property called "cycle" cannot be
       mistaken for one. */
    return { [CYCLE]: repeats.slice(0, -1) };
  }

  ancestors.set(node, path);
  let out;
  if (Array.isArray(node)) {
    out = [];
    for (const [i, item] of node.entries()) {
      const child = decycle(item, ancestors, [...path, i]);
      if (child && child[CYCLE]) {
        ancestors.delete(node);
        return { $ref: pointerFor(child[CYCLE]) };
      }
      out.push(child);
    }
  } else {
    out = {};
    for (const [key, value] of Object.entries(node)) {
      const child = decycle(value, ancestors, [...path, key]);
      if (child && child[CYCLE]) {
        ancestors.delete(node);
        return { $ref: pointerFor(child[CYCLE]) };
      }
      out[key] = child;
    }
  }
  ancestors.delete(node);
  return out;
}

/**
 * The document with every `$ref` followed, for reading only.
 *
 * Storage keeps the refs: a spec with twelve shared schemas should export as
 * twelve shared schemas, not as twelve copies inlined per operation. This copy
 * exists so the viewer and the import can see the shape a pointer stands for
 * without the document losing what makes it DRY.
 */
export async function resolveDocument(doc) {
  if (!isRecord(doc)) return { resolved: doc, errors: [] };
  /* Community: no @scalar dereference — canvas builds and JSON imports work
     without following $ref. Unresolved refs still show in the raw document. */
  return { resolved: doc, errors: [] };
}

/**
 * The document a service actually has: whatever was stored — info, servers,
 * shared schemas, security — with every endpoint element's operation written
 * over it, so the canvas and the contract cannot disagree.
 */
export function buildServiceDocument(endpoints, meta, stored) {
  const parsed = stored ? parseServiceDocument(stored) : null;
  const base = parsed && parsed.ok ? { ...parsed.doc, paths: { ...parsed.doc.paths } } : emptyDocument(meta);

  base.info = {
    ...base.info,
    title: base.info?.title || meta?.title || 'Service',
    version: base.info?.version || meta?.version || '1.0.0',
    ...(meta?.description && !base.info?.description ? { description: meta.description } : {}),
  };

  const paths = {};
  const channels = { ...(base['x-channels'] || {}) };
  const grpc = { ...(base['x-grpc'] || {}) };
  const list = Array.isArray(endpoints) ? endpoints : [];

  for (const endpoint of list) {
    const path = toOpenApiPath(endpoint?.path || endpoint?.endpoint || '/');
    const method = endpoint?.method || 'GET';

    if (isWebSocketMethod(method)) {
      const send = isRecord(endpoint?.request) ? endpoint.request : null;
      const receive = isRecord(endpoint?.response) ? endpoint.response : null;
      if (send && Array.isArray(send.messages) && send.messages.length) {
        channels[`${path}#send`] = channelFrom(send, method, 'send');
      }
      if (receive && Array.isArray(receive.messages) && receive.messages.length) {
        channels[`${path}#receive`] = channelFrom(receive, method, 'receive');
      }
      continue;
    }

    if (isGrpcMethod(method)) {
      const request = isRecord(endpoint?.request) ? endpoint.request : null;
      const response = isRecord(endpoint?.response) ? endpoint.response : null;
      if (
        (request && (request.source || request.name)) ||
        (response && (response.source || response.name))
      ) {
        grpc[path] = {
          ...grpcFrom(endpoint),
          summary: String(endpoint?.name || '').trim() || undefined,
          description: String(endpoint?.description || '').trim() || undefined,
        };
      }
      continue;
    }

    const item = { ...(paths[path] || base.paths[path] || {}) };
    item[methodKey(method)] = operationFromEndpoint({ ...endpoint, path });
    paths[path] = item;
  }

  /* Paths the stored document carries that no element claims stay put: an
     imported spec is allowed to be ahead of the diagram. */
  for (const [path, item] of Object.entries(base.paths)) {
    if (!paths[path]) paths[path] = item;
  }

  const doc = { ...base, paths };
  if (Object.keys(channels).length) doc['x-channels'] = channels;
  else delete doc['x-channels'];
  if (Object.keys(grpc).length) doc['x-grpc'] = grpc;
  else delete doc['x-grpc'];
  return doc;
}

/** Every operation in a document, in document order. */
export function listOperations(doc) {
  const out = [];
  for (const [path, item] of Object.entries(doc?.paths || {})) {
    if (!isRecord(item)) continue;
    for (const verb of HTTP_VERBS) {
      if (isRecord(item[verb])) {
        out.push({ path, method: verb.toUpperCase(), operation: item[verb] });
      }
    }
  }
  return out;
}

/**
 * A document taken apart into what the canvas needs, one entry per operation.
 * `resolved` is the same document with its pointers followed; without it a
 * `$ref`'d parameter or response reads as empty.
 */
export function endpointsFromDocument(doc, resolved) {
  const view = isRecord(resolved) ? resolved : doc;
  const operations = listOperations(view).map(({ path, method, operation }) => {
    const rawOperation = doc?.paths?.[path]?.[method.toLowerCase()];
    const contracts = contractsFromOperation(operation, rawOperation);
    const summary = typeof operation.summary === 'string' ? operation.summary.trim() : '';
    const description =
      typeof operation.description === 'string' ? operation.description.trim() : '';
    return {
      path,
      method,
      name: summary || `${method} ${path}`,
      description,
      tags: Array.isArray(operation.tags) ? operation.tags.filter((t) => typeof t === 'string') : [],
      request: contracts.request,
      response: contracts.response,
    };
  });

  const channels = isRecord(view?.['x-channels']) ? view['x-channels'] : {};
  const byPath = new Map();
  for (const [key, channel] of Object.entries(channels)) {
    const [path, direction] = key.split('#');
    const entry = byPath.get(path) || {
      path,
      method: String(channel?.protocol || 'WS').toUpperCase(),
      name: path,
      description: '',
      tags: [],
      request: { side: 'request', mode: 'channel', messages: [] },
      response: { side: 'response', mode: 'channel', messages: [] },
      channel: true,
    };
    const parsed = channelTo(channel);
    if (direction === 'send') entry.request = { side: 'request', ...parsed };
    else entry.response = { side: 'response', ...parsed };
    byPath.set(path, entry);
  }

  return [
    ...operations,
    ...byPath.values(),
    ...Object.entries(isRecord(view?.['x-grpc']) ? view['x-grpc'] : {}).map(([path, entry]) => {
      const contracts = grpcTo(entry);
      const summary =
        typeof entry?.summary === 'string' && entry.summary.trim()
          ? entry.summary.trim()
          : path;
      return {
        path,
        method: 'GRPC',
        name: summary,
        description: typeof entry?.description === 'string' ? entry.description : '',
        tags: ['grpc'],
        request: contracts.request,
        response: contracts.response,
        grpc: true,
      };
    }),
  ];
}

/**
 * Import merge: the incoming file wins for every operation it describes, and
 * everything the service already had that the file is silent about is kept.
 */
export function mergeServiceDocument(base, incoming) {
  if (!base) return incoming;
  const paths = { ...(base.paths || {}) };
  for (const [path, item] of Object.entries(incoming?.paths || {})) {
    paths[path] = { ...(paths[path] || {}), ...(isRecord(item) ? item : {}) };
  }
  const components = { ...(base.components || {}) };
  for (const [group, value] of Object.entries(incoming?.components || {})) {
    const existing = components[group];
    components[group] = isRecord(existing) && isRecord(value) ? { ...existing, ...value } : value;
  }
  const channels = { ...(base['x-channels'] || {}), ...(incoming?.['x-channels'] || {}) };
  const grpc = { ...(base['x-grpc'] || {}), ...(incoming?.['x-grpc'] || {}) };
  return {
    ...base,
    ...incoming,
    info: { ...(base.info || {}), ...(incoming?.info || {}) },
    paths,
    ...(Object.keys(components).length ? { components } : {}),
    ...(Object.keys(channels).length ? { 'x-channels': channels } : {}),
    ...(Object.keys(grpc).length ? { 'x-grpc': grpc } : {}),
  };
}

/** File name for an exported service contract. */
export function serviceDocumentFileName(title) {
  const slug =
    String(title || 'service')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'service';
  return `${slug}-openapi.json`;
}
