import { openapiApi } from '@shared/api';
import {
  parseHttpContract,
  serializeHttpContract,
  type HttpContract,
} from '@components/common/HttpContract';
import {
  parseProtobufContract,
  serializeProtobufContract,
  type ProtobufContract,
} from '@components/common/ProtobufContract';
import { isGrpcMethod, isWebSocketMethod, type EndpointExtras } from '@/types/c4Extensions';
import type { ComponentBlock, ContainerBlock, FlatC4Model } from '@archivisio/c4-modelizer-sdk';

/**
 * A container is a service, and a service's contract is an OpenAPI document
 * stored on the container. Endpoint elements are the canvas view of its
 * `paths[path][method]` operations.
 *
 * The conversion itself lives on the server (`server/src/openapi.js`) — this
 * module only translates between the editor's stored contract text and the
 * structured shape the API speaks, and calls it.
 */

export type OpenApiDocument = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  servers?: Array<Record<string, unknown>>;
  tags?: Array<Record<string, unknown>>;
  'x-channels'?: Record<string, unknown>;
  'x-grpc'?: Record<string, unknown>;
} & Record<string, unknown>;

/** One endpoint as the conversion API wants it. */
export type ServiceEndpointPayload = {
  path: string;
  method: string;
  name: string;
  description: string;
  tags: string[];
  group?: string;
  headers?: string;
  request: HttpContract | ProtobufContract;
  response: HttpContract | ProtobufContract;
};

export type ImportedEndpoint = {
  path: string;
  method: string;
  name: string;
  description: string;
  tags: string[];
  request: HttpContract | ProtobufContract;
  response: HttpContract | ProtobufContract;
  channel?: boolean;
  grpc?: boolean;
};

export type ServiceMeta = { title: string; version?: string; description?: string };

type EndpointElement = ComponentBlock & EndpointExtras & { tags?: string[]; group?: string };

/** Endpoint elements of one container, in canvas order. */
export function containerEndpoints(model: FlatC4Model, containerId: string): EndpointElement[] {
  return model.components.filter(
    (c) =>
      c.containerId === containerId &&
      ((c as EndpointExtras).kind === 'endpoint' ||
        typeof (c as EndpointExtras).endpoint === 'string')
  ) as EndpointElement[];
}

/**
 * How many operations a service card should advertise.
 *
 * Canvas endpoints are the primary source. When a clone card is a live view of
 * another container (local or remote), the original's stored OpenAPI/`x-grpc`
 * document is merged onto the card the same way documentation is — so a clone
 * without local child endpoints still shows the contract badge.
 */
export function countStoredContractOperations(openapi: string | undefined | null): number {
  const raw = (openapi || '').trim();
  if (!raw) return 0;
  try {
    const doc = JSON.parse(raw) as OpenApiDocument;
    return viewerOperations(doc).length;
  } catch {
    return 0;
  }
}

export function serviceContractOperationCount(
  model: FlatC4Model,
  containerId: string,
  containerExtras?: { openapi?: string } | null
): number {
  const fromCanvas = containerEndpoints(model, containerId).length;
  if (fromCanvas > 0) return fromCanvas;
  return countStoredContractOperations(containerExtras?.openapi);
}

/**
 * Where the contract badge on a card should point.
 *
 * A plain service uses itself. A system projected as a container card (clone
 * used to wire cross-system links) has no endpoints of its own — roll up the
 * services inside that system, same way docs already surface on the card.
 */
export function serviceContractOwnerForCard(
  model: FlatC4Model,
  ownerId: string,
  opts?: { originalType?: string; openapi?: string } | null
): { containerId: string; count: number; openapi?: string } | null {
  if (opts?.originalType === 'system') {
    let total = 0;
    let firstId: string | null = null;
    let firstOpenapi: string | undefined;
    for (const c of model.containers) {
      if (c.systemId !== ownerId || c.original) continue;
      const openapi = (c as ContainerBlock & { openapi?: string }).openapi;
      const n = serviceContractOperationCount(model, c.id, { openapi });
      if (n > 0 && !firstId) {
        firstId = c.id;
        firstOpenapi = openapi;
      }
      total += n;
    }
    if (!total || !firstId) return null;
    return { containerId: firstId, count: total, openapi: firstOpenapi };
  }

  const count = serviceContractOperationCount(model, ownerId, {
    openapi: opts?.openapi,
  });
  if (!count) return null;
  return { containerId: ownerId, count, openapi: opts?.openapi };
}

export function toPayload(element: EndpointElement): ServiceEndpointPayload {
  const method = element.method || 'GET';
  if (isGrpcMethod(method)) {
    return {
      path: element.endpoint || '/',
      method,
      name: element.name || '',
      description: element.description || '',
      tags: element.tags || [],
      group: element.group,
      headers: element.headers || '',
      request: parseProtobufContract(element.request || '', 'request'),
      response: parseProtobufContract(element.response || '', 'response'),
    };
  }
  const channel = isWebSocketMethod(method);
  return {
    path: element.endpoint || '/',
    method,
    name: element.name || '',
    description: element.description || '',
    tags: element.tags || [],
    group: element.group,
    headers: element.headers || '',
    request: parseHttpContract(element.request || '', 'request', { channel }),
    response: parseHttpContract(element.response || '', 'response', { channel }),
  };
}

/** Structured contract → the text an endpoint element stores. */
export function contractText(contract: HttpContract | ProtobufContract): string {
  if (contract.mode === 'protobuf') return serializeProtobufContract(contract);
  return serializeHttpContract(contract);
}

export function serviceMetaFor(container: ContainerBlock): ServiceMeta {
  return {
    title: container.name || 'Service',
    description: container.description || undefined,
  };
}

/** The stored contract document of a container, if it has one. */
export function storedDocument(container: ContainerBlock): string | undefined {
  const raw = (container as ContainerBlock & { openapi?: string }).openapi;
  return raw && raw.trim() ? raw : undefined;
}

/**
 * The service's document, plus the same document with its `$ref`s followed.
 *
 * Storage and export use `doc`, so a spec's shared components stay shared;
 * everything that reads a shape uses `resolved`, because a pointer says
 * nothing on screen until it is followed.
 */
export async function buildServiceDocument(
  endpoints: ServiceEndpointPayload[],
  meta: ServiceMeta,
  stored?: string
): Promise<{ doc: OpenApiDocument; resolved: OpenApiDocument }> {
  const { doc, resolved } = await openapiApi.openapiBuild({ endpoints, meta, stored });
  return { doc, resolved: resolved ?? doc };
}

export async function parseServiceDocument(
  json: string,
  stored?: string
): Promise<{
  doc: OpenApiDocument;
  resolved: OpenApiDocument;
  endpoints: ImportedEndpoint[];
  refErrors?: string[];
}> {
  const result = await openapiApi.openapiParse({ json, stored });
  /* The API speaks the same structured contract the editor does; it is typed
     loosely on the wire because the client owns that shape, not the server. */
  return {
    doc: result.doc,
    resolved: result.resolved ?? result.doc,
    endpoints: result.endpoints as unknown as ImportedEndpoint[],
    refErrors: result.refErrors,
  };
}

export function documentJson(doc: OpenApiDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** The contract as a file to save — built, serialized and named by the server. */
export async function exportServiceDocument(
  endpoints: ServiceEndpointPayload[],
  meta: ServiceMeta,
  stored?: string
): Promise<Blob> {
  return openapiApi.openapiExport({ endpoints, meta, stored });
}

/** Mirror of the server's naming, for the download attribute. */
export function exportFileName(title: string): string {
  const slug =
    (title || 'service')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'service';
  return `${slug}-openapi.json`;
}

/**
 * Rebuild a container's stored contract from what is on the canvas.
 *
 * Called after an endpoint is saved, so the document in the project is the
 * service's real contract rather than a snapshot from whenever it was last
 * imported. Best effort on purpose: without the API (offline, or a guest with
 * no server) the endpoints still carry their contracts and the document is
 * rebuilt the next time it is asked for.
 */
export async function refreshServiceContract(
  containerId: string | undefined,
  updateContainer: (id: string, patch: Partial<ContainerBlock>) => void
): Promise<{ doc: OpenApiDocument; resolved: OpenApiDocument } | null> {
  if (!containerId) return null;
  const { useFlatC4Store } = await import('@archivisio/c4-modelizer-sdk');
  const model = useFlatC4Store.getState().model;
  const container = model.containers.find((c) => c.id === containerId);
  if (!container) return null;
  try {
    const { doc, resolved } = await buildServiceDocument(
      containerEndpoints(model, containerId).map(toPayload),
      serviceMetaFor(container),
      storedDocument(container)
    );
    /* Stored unresolved on purpose — the refs are the contract's own words. */
    updateContainer(containerId, { openapi: documentJson(doc) } as Partial<ContainerBlock>);
    return { doc, resolved };
  } catch {
    /* Leave the stored document alone rather than writing a half-built one. */
    return null;
  }
}

/**
 * One operation taken out of a stored document.
 *
 * An operation lives in one of three places depending on what it is — a verb
 * under `paths`, an entry in `x-channels`, one in `x-grpc` — and the viewer's
 * key already says which, so it is the key that decides where to cut. Falling
 * back to path + verb keeps this usable from the canvas, where there is no
 * viewer key to hand.
 *
 * @returns the document without it, or undefined when nothing matched — so a
 * caller can tell "removed" from "was not there" and skip a pointless write.
 */
export function removeOperationFromDocument(
  stored: string | undefined | null,
  op: { key?: string; path: string; method: string }
): string | undefined {
  const raw = (stored || '').trim();
  if (!raw) return undefined;

  let doc: OpenApiDocument;
  try {
    doc = JSON.parse(raw) as OpenApiDocument;
  } catch {
    /* A document that will not parse is not one to rewrite blindly. */
    return undefined;
  }

  const next = { ...doc } as OpenApiDocument & Record<string, unknown>;
  let changed = false;

  const key = op.key || '';
  if (key.startsWith('channel:')) {
    const channels = { ...((next['x-channels'] as Record<string, unknown>) || {}) };
    if (key.slice('channel:'.length) in channels) {
      delete channels[key.slice('channel:'.length)];
      changed = true;
      if (Object.keys(channels).length) next['x-channels'] = channels;
      else delete next['x-channels'];
    }
  } else if (key.startsWith('grpc:')) {
    const grpc = { ...((next['x-grpc'] as Record<string, unknown>) || {}) };
    if (key.slice('grpc:'.length) in grpc) {
      delete grpc[key.slice('grpc:'.length)];
      changed = true;
      if (Object.keys(grpc).length) next['x-grpc'] = grpc;
      else delete next['x-grpc'];
    }
  } else {
    const verb = (op.method || 'GET').toLowerCase();
    const paths = { ...(next.paths || {}) };
    const item = paths[op.path];
    if (item && typeof item === 'object' && verb in (item as Record<string, unknown>)) {
      const nextItem = { ...(item as Record<string, unknown>) };
      delete nextItem[verb];
      changed = true;
      /* A path with no verbs left is not a path any more. */
      const stillHasVerb = HTTP_VERBS.some((v) => v in nextItem);
      if (stillHasVerb) paths[op.path] = nextItem as OpenApiDocument['paths'][string];
      else delete paths[op.path];
      next.paths = paths;
    }
  }

  return changed ? documentJson(next) : undefined;
}

/**
 * Forget an endpoint that has just been deleted from the canvas.
 *
 * The stored document and the endpoint elements are two halves of one
 * contract, and the merge that joins them keeps any stored path no element
 * claims — written that way so an imported spec may run ahead of the diagram.
 * The cost is that deleting the element alone leaves the operation on show
 * with no way to reach it. Deleting from either half now removes it from both.
 */
export function forgetEndpointOperation(
  model: FlatC4Model,
  element: { containerId?: string; endpoint?: string; method?: string } | null | undefined,
  updateContainer: (id: string, patch: Partial<ContainerBlock>) => void
): void {
  const containerId = element?.containerId;
  if (!containerId || !element?.endpoint) return;
  const container = model.containers.find((c) => c.id === containerId);
  if (!container) return;
  const next = removeOperationFromDocument(storedDocument(container), {
    path: element.endpoint,
    method: element.method || 'GET',
  });
  if (next) updateContainer(containerId, { openapi: next } as Partial<ContainerBlock>);
}

/** Identity of an operation: the verb plus the path, in one spelling. */
export function operationKey(path: string, method: string): string {
  const normalized = (path || '/')
    .trim()
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/<([A-Za-z0-9_]+)>/g, '{$1}');
  return `${(method || 'GET').trim().toUpperCase()} ${
    normalized.startsWith('/') ? normalized : `/${normalized}`
  }`;
}

export type ImportOutcome = { updated: number; added: number; model: FlatC4Model };

/**
 * Fold an imported document into the model: matching operations update the
 * endpoint element that stands for them, new ones arrive as new elements under
 * the container, and endpoints the file is silent about are left alone.
 */
export function applyImportedDocument(
  model: FlatC4Model,
  options: {
    containerId: string;
    imported: ImportedEndpoint[];
    openapi: string;
    /** Audit stamp for whatever gets created or touched. */
    stamp?: Record<string, unknown>;
    newElement: (index: number) => Record<string, unknown>;
  }
): ImportOutcome {
  const { containerId, imported, openapi, stamp = {}, newElement } = options;
  const existing = containerEndpoints(model, containerId);
  const byKey = new Map(
    existing.map((element) => [
      operationKey(element.endpoint || '/', element.method || 'GET'),
      element,
    ])
  );

  let updated = 0;
  const touched = new Map<string, Partial<EndpointElement>>();
  const added: Record<string, unknown>[] = [];

  imported.forEach((entry) => {
    const key = operationKey(entry.path, entry.method);
    const patch = {
      name: entry.name,
      description: entry.description,
      request: contractText(entry.request),
      response: contractText(entry.response),
      ...(entry.tags.length ? { tags: entry.tags } : {}),
    };
    const match = byKey.get(key);
    if (match) {
      updated += 1;
      touched.set(match.id, patch);
      return;
    }
    added.push({
      ...newElement(added.length),
      ...patch,
      kind: 'endpoint',
      endpoint: entry.path,
      method: entry.method,
      containerId,
      type: 'component',
      connections: [],
      ...stamp,
    });
  });

  const components = model.components.map((component) => {
    const patch = touched.get(component.id);
    return patch ? { ...component, ...patch, ...stamp } : component;
  });

  return {
    updated,
    added: added.length,
    model: {
      ...model,
      components: [...components, ...added] as FlatC4Model['components'],
      containers: model.containers.map((container) =>
        container.id === containerId ? { ...container, openapi } : container
      ) as FlatC4Model['containers'],
    },
  };
}

/** Operations of a document, flattened for the contract viewer's list. */
export type ViewerOperation = {
  key: string;
  path: string;
  method: string;
  summary: string;
  description: string;
  tags: string[];
  operation: Record<string, unknown>;
  /** Protocol bucket for the viewer list — HTTP verbs, WS/WSS, or GRPC. */
  kind: 'http' | 'websocket' | 'grpc';
};

const HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

export function viewerOperationKind(method: string): ViewerOperation['kind'] {
  const m = (method || '').toUpperCase();
  if (m === 'GRPC') return 'grpc';
  if (m === 'WS' || m === 'WSS') return 'websocket';
  return 'http';
}

export function viewerOperations(doc: OpenApiDocument | null): ViewerOperation[] {
  if (!doc) return [];
  const out: ViewerOperation[] = [];
  for (const [path, item] of Object.entries(doc.paths || {})) {
    if (typeof item !== 'object' || item === null) continue;
    for (const verb of HTTP_VERBS) {
      const operation = (item as Record<string, unknown>)[verb];
      if (typeof operation !== 'object' || operation === null) continue;
      const op = operation as Record<string, unknown>;
      out.push({
        key: `${verb}:${path}`,
        path,
        method: verb.toUpperCase(),
        summary: typeof op.summary === 'string' ? op.summary : '',
        description: typeof op.description === 'string' ? op.description : '',
        tags: Array.isArray(op.tags) ? op.tags.filter((t): t is string => typeof t === 'string') : [],
        operation: op,
        kind: 'http',
      });
    }
  }

  const channels = doc['x-channels'];
  if (typeof channels === 'object' && channels !== null) {
    for (const [key, value] of Object.entries(channels as Record<string, unknown>)) {
      const channel = value as { direction?: string; protocol?: string; messages?: unknown[] };
      const [path, direction] = key.split('#');
      out.push({
        key: `channel:${key}`,
        path,
        method: (channel.protocol || 'WS').toUpperCase(),
        summary: direction === 'send' ? 'Client → server' : 'Server → client',
        description: '',
        tags: ['channels'],
        operation: channel as Record<string, unknown>,
        kind: 'websocket',
      });
    }
  }

  const grpc = doc['x-grpc'];
  if (typeof grpc === 'object' && grpc !== null) {
    for (const [path, value] of Object.entries(grpc as Record<string, unknown>)) {
      const entry = value as {
        streaming?: string;
        summary?: string;
        description?: string;
        request?: { name?: string; proto?: string };
        response?: { name?: string; proto?: string };
      };
      const req = entry.request?.name || 'Request';
      const res = entry.response?.name || 'Response';
      out.push({
        key: `grpc:${path}`,
        path,
        method: 'GRPC',
        summary: entry.summary || `${req} → ${res}`,
        description: entry.description || '',
        tags: ['grpc', entry.streaming || 'unary'].filter(Boolean),
        operation: entry as Record<string, unknown>,
        kind: 'grpc',
      });
    }
  }

  return out;
}

export function documentProtocolMix(doc: OpenApiDocument | null): {
  http: number;
  websocket: number;
  grpc: number;
} {
  const ops = viewerOperations(doc);
  return {
    http: ops.filter((o) => o.kind === 'http').length,
    websocket: ops.filter((o) => o.kind === 'websocket').length,
    grpc: ops.filter((o) => o.kind === 'grpc').length,
  };
}

/** `/pkg.Service/Method` → parts used when writing a .proto file. */
export function parseGrpcRpcPath(path: string): {
  packageName: string;
  service: string;
  method: string;
} {
  const trimmed = (path || '').replace(/^\//, '').trim();
  const [qualified = '', method = 'Method'] = trimmed.split('/');
  const parts = qualified.split('.').filter(Boolean);
  const service = parts.pop() || 'Service';
  return {
    packageName: parts.join('.'),
    service,
    method: method || 'Method',
  };
}

function ensureMessageBlock(name: string, proto: string): string {
  const source = (proto || '').trim();
  if (source) return source;
  if (!name) return '';
  return `message ${name} {\n}`;
}

/** One .proto per gRPC RPC, ready to drop into an export archive. */
export function buildGrpcProtoFiles(
  doc: OpenApiDocument | null
): Array<{ filename: string; content: string; path: string }> {
  const grpc = doc?.['x-grpc'];
  if (typeof grpc !== 'object' || grpc === null) return [];

  const out: Array<{ filename: string; content: string; path: string }> = [];
  const used = new Set<string>();

  for (const [path, value] of Object.entries(grpc as Record<string, unknown>)) {
    const entry = value as {
      streaming?: string;
      request?: { name?: string; proto?: string };
      response?: { name?: string; proto?: string };
    };
    const { packageName, service, method } = parseGrpcRpcPath(path);
    const reqName = entry.request?.name || `${method}Request`;
    const resName = entry.response?.name || `${method}Response`;
    const stream = entry.streaming || 'unary';

    const reqType =
      stream === 'client' || stream === 'bidi' ? `stream ${reqName}` : reqName;
    const resType =
      stream === 'server' || stream === 'bidi' ? `stream ${resName}` : resName;

    const lines = ['syntax = "proto3";', ''];
    if (packageName) {
      lines.push(`package ${packageName};`, '');
    }
    const reqBlock = ensureMessageBlock(reqName, entry.request?.proto || '');
    const resBlock = ensureMessageBlock(resName, entry.response?.proto || '');
    if (reqBlock) lines.push(reqBlock, '');
    if (resBlock) lines.push(resBlock, '');
    lines.push(`service ${service} {`);
    lines.push(`  rpc ${method} (${reqType}) returns (${resType});`);
    lines.push('}', '');

    let filename = `protos/${service}_${method}.proto`.replace(/[^\w./-]+/g, '_');
    if (used.has(filename)) {
      let i = 2;
      while (used.has(filename.replace(/\.proto$/, `_${i}.proto`))) i += 1;
      filename = filename.replace(/\.proto$/, `_${i}.proto`);
    }
    used.add(filename);
    out.push({ filename, content: lines.join('\n'), path });
  }

  return out;
}
