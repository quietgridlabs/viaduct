/** App-level extension — not in SDK BaseBlock yet, persisted via store merge + Yjs. */
export type ExternalFlag = {
  external?: boolean;
};

/** Shared free-form labels. Catalog = union of tags used on any element in the model. */
export const MAX_ELEMENT_TAGS = 3;
export const TAG_MAX_LENGTH = 32;
/** Short blurb under the name on system / container / component / code / endpoint cards. */
export const ELEMENT_DESCRIPTION_MAX = 120;

export function clampElementDescription(raw: unknown): string {
  return String(raw ?? '').slice(0, ELEMENT_DESCRIPTION_MAX);
}

export type TagExtras = {
  tags?: string[];
};

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX_LENGTH);
}

export function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of tags) {
    if (typeof item !== 'string') continue;
    const tag = normalizeTag(item);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_ELEMENT_TAGS) break;
  }
  return out;
}

export function getElementTags(item: unknown): string[] {
  if (!item || typeof item !== 'object') return [];
  return sanitizeTags((item as TagExtras).tags);
}

export function resolveCatalogTag(
  raw: string,
  catalog: string[],
  selected: string[] = []
): string | null {
  const tag = normalizeTag(raw);
  if (!tag) return null;
  const key = tag.toLowerCase();
  const fromSelected = selected.find((t) => t.toLowerCase() === key);
  if (fromSelected) return fromSelected;
  const fromCatalog = catalog.find((t) => t.toLowerCase() === key);
  return fromCatalog || tag;
}

export function collectModelTags(model: {
  systems?: unknown[];
  containers?: unknown[];
  components?: unknown[];
  codeElements?: unknown[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of [
    model.systems,
    model.containers,
    model.components,
    model.codeElements,
  ]) {
    for (const el of list || []) {
      for (const tag of getElementTags(el)) {
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(tag);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export const GROUP_MAX_LENGTH = 48;
export const GROUP_NODE_PREFIX = '__group:';

export type GroupExtras = {
  /** Visual boundary name. Same name on siblings of one diagram = one box. */
  group?: string;
};

export function normalizeGroup(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').slice(0, GROUP_MAX_LENGTH);
}

export function getElementGroup(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  return normalizeGroup((item as GroupExtras).group);
}

export function resolveCatalogGroup(raw: string, catalog: string[]): string | null {
  const group = normalizeGroup(raw);
  if (!group) return null;
  const key = group.toLowerCase();
  const fromCatalog = catalog.find((g) => g.toLowerCase() === key);
  return fromCatalog || group;
}

export function collectModelGroups(model: {
  systems?: unknown[];
  containers?: unknown[];
  components?: unknown[];
  codeElements?: unknown[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of [
    model.systems,
    model.containers,
    model.components,
    model.codeElements,
  ]) {
    for (const el of list || []) {
      const group = getElementGroup(el);
      if (!group) continue;
      const key = group.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(group);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function isGroupFrameNodeId(id: string | undefined): boolean {
  return Boolean(id && id.startsWith(GROUP_NODE_PREFIX));
}

export const EDGE_PATH_TYPES = ['bezier', 'straight', 'step'] as const;
export type EdgePathType = (typeof EDGE_PATH_TYPES)[number];

export function normalizeEdgePathType(raw: unknown): EdgePathType {
  return raw === 'straight' || raw === 'step' ? raw : 'bezier';
}

/** App-level extension on connections — links a container edge to implementing components. */
export const CHANNEL_ROLES = ['produce', 'consume'] as const;
export type ChannelRole = (typeof CHANNEL_ROLES)[number];

export function normalizeChannelRole(raw: unknown): ChannelRole | undefined {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  return value === 'produce' || value === 'consume' ? value : undefined;
}

export type ConnectionExtras = {
  relatedComponentIds?: string[];
  foreignKey?: {
    sourceColumnId: string;
    targetColumnId: string;
  };
  /** Canvas routing: curved, straight, or orthogonal. */
  pathType?: EdgePathType;
  bidirectional?: boolean;
  /** Explicit produce/consume when the edge touches a broker. */
  channelRole?: ChannelRole;
};

export type TableColumn = {
  id: string;
  name: string;
  dataType: string;
  primaryKey?: boolean;
  /** Defaults to true when not primary key. */
  nullable?: boolean;
};

export type TableExtras = {
  columns?: TableColumn[];
};

export type ForeignKeyExtras = Pick<ConnectionExtras, 'foreignKey'>;

/** HTTP API endpoint component (lives on the component layer alongside regular components). */
export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * A WebSocket channel is an endpoint too: it has a path, a contract and an
 * owning container. Only the way it is spoken differs, so the protocol takes
 * the verb slot instead of the element growing a second kind.
 */
export const WEBSOCKET_METHODS = ['WS', 'WSS'] as const;

/**
 * Same idea as WebSocket: gRPC RPCs live on the endpoint layer, and the
 * protocol occupies the verb slot. The path is `/package.Service/Method`.
 */
export const GRPC_METHODS = ['GRPC'] as const;

export const ENDPOINT_METHODS = [
  ...HTTP_METHODS,
  ...WEBSOCKET_METHODS,
  ...GRPC_METHODS,
] as const;

export type EndpointMethod = (typeof ENDPOINT_METHODS)[number];

export function isWebSocketMethod(method?: string): boolean {
  return (WEBSOCKET_METHODS as readonly string[]).includes(
    (method || '').trim().toUpperCase()
  );
}

export function isGrpcMethod(method?: string): boolean {
  return (GRPC_METHODS as readonly string[]).includes(
    (method || '').trim().toUpperCase()
  );
}

export type EndpointExtras = {
  /** Discriminator — prefer this over inferring from `endpoint` alone. */
  kind?: 'endpoint';
  /** Path, e.g. `/api/users/:id` — or the channel, e.g. `/ws/orders`,
   *  or a gRPC RPC, e.g. `/billing.v1.InvoiceService/GetInvoice`. */
  endpoint?: string;
  /** HTTP verb, `WS` / `WSS` for a WebSocket channel, or `GRPC`. */
  method?: EndpointMethod | string;
  /** Request example: query params and/or body (JSON / text). Structured tagged
   *  format, or legacy plain JSON. For gRPC: protobuf message source. */
  request?: string;
  /** Response example: status line and optional body. Structured tagged format,
   *  legacy plain JSON (implies 200), or a bare `200 OK`. For gRPC: protobuf
   *  message source. */
  response?: string;
  /** HTTP headers (one per line, e.g. `Authorization: Bearer …`). */
  headers?: string;
};

/**
 * The service contract of a container, as an OpenAPI document.
 *
 * Endpoint elements under the container are the canvas view of its
 * `paths[path][method]` operations; the document additionally holds everything
 * an element cannot express — info, servers, shared schemas, security — and is
 * rebuilt by the server on every endpoint save (see `utils/serviceContract`).
 */
export type ServiceContractExtras = {
  /** OpenAPI 3.1 document, JSON text. */
  openapi?: string;
};

/** PlantUML sequence diagrams bound to a container or component. */
export type StoredSequenceDiagram = {
  id: string;
  name: string;
  plantUmlSource: string;
  modelVersion: 1;
  createdAt: string;
  updatedAt: string;
  createdBy?: PersonRef;
  updatedBy?: PersonRef;
};

export type SequenceDiagramExtras = {
  sequenceDiagrams?: StoredSequenceDiagram[];
};

/** Named domain boundary inside a project (system- or container-level). */
export type DomainLevel = 'system' | 'container';

export type Domain = {
  id: string;
  name: string;
  level: DomainLevel;
  description?: string;
  /** Accent on the domain map; falls back to the C4 level colour. */
  color?: string;
};

export type DomainExtras = {
  domains?: Domain[];
};

/** Optional domain assignment on systems / containers. */
export type DomainMembership = {
  domainId?: string;
};

/** Pointer on a clone card — local when `projectId` is omitted. */
export type CloneOriginalRef = {
  id: string;
  type: string;
  /** Other project when the original lives elsewhere. */
  projectId?: string;
  /** Snapshot for cross-domain clone labels. */
  projectName?: string;
  domainId?: string;
  domainName?: string;
};

/** C4 entity a data-flow step can name as a participant. */
export type FlowOwnerType = 'system' | 'container' | 'component' | 'code';

export type FlowParticipantRef = {
  id: string;
  type: FlowOwnerType;
  /** When set, the participant lives in another project (cross-domain hop). */
  projectId?: string;
  /** Snapshot for display without a live fetch — mirrors CloneOriginalRef. */
  name?: string;
  projectName?: string;
  domainId?: string;
  domainName?: string;
};

export type DataFlowConnectionRef = {
  sourceId: string;
  targetId: string;
};

/**
 * How the branches of a multi-step stage relate to each other.
 *  • `parallel` — every branch happens (PlantUML `par`).
 *  • `alternative` — exactly one branch happens (PlantUML `alt`).
 */
export type FlowBranchKind = 'parallel' | 'alternative';

/** Where playback goes when it runs out of this flow's own steps. */
export type FlowContinuationRef = {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
};

/** One hop in a project-level data flow (finite-state walk). */
export type DataFlowStep = {
  id: string;
  name: string;
  description?: string;
  from: FlowParticipantRef;
  to: FlowParticipantRef;
  /** Endpoint component ids involved in this hop. */
  endpointIds?: string[];
  /** Broker channel ids involved in this hop — not mixed into endpointIds. */
  channelIds?: string[];
  /** Same-level connections this hop uses. */
  connections?: DataFlowConnectionRef[];
  /**
   * Consecutive steps with the same id play as one stage (async / fan-out).
   * Omit for sequential hops.
   *
   * The name predates alternatives and is kept because it is written into every
   * stored flow; `branchKind` says what the grouping actually means.
   */
  parallelGroupId?: string;
  /**
   * Only meaningful on grouped steps, and the same on every step of a group.
   * Absent means `parallel`, which is what every flow stored before
   * alternatives existed meant.
   */
  branchKind?: FlowBranchKind;
  /**
   * Which track of the fork this step runs on.
   *
   * A branch is a sequence, not a single hop: "if the key is WB, check the
   * scope, then confirm access" is one arm of two steps, and the other arm can
   * be one step long. Steps of an arm are stored consecutively, and the arms of
   * a stage are stored one after another.
   *
   * Absent means the step is an arm of its own, which is what every flow stored
   * before arms existed meant — back then a branch could only ever be one step.
   */
  branchArmId?: string;
  /**
   * Absent/`'hop'` is today's participant hop. `'link'` is a step that
   * exists only to jump playback to another flow — `from`/`to` are unused
   * stubs on it, `nextFlowRef` is what matters. Positioned like any other
   * step, so the jump can happen wherever it's placed, not just at the end.
   */
  kind?: 'hop' | 'link';
  /** Set when `kind === 'link'` — where this step sends playback. */
  nextFlowRef?: FlowContinuationRef;
};

/** Project-root collection — not attached to a single container/component. */
/**
 * One thing a Magic flow leans on, as it looked when the flow was last checked.
 *
 * Stored with the flow rather than in a table of its own: flows live inside the
 * model, so the record travels with collaboration, versions and export instead
 * of drifting from what it describes. See `utils/flowValidation`.
 */
export type FlowDependency = {
  /** `el:<id>`, `ep:<id>`, `ch:<id>`, `cn:<src>><tgt>`, `ex:<id>`. */
  key: string;
  kind: 'element' | 'endpoint' | 'channel' | 'connection' | 'external';
  name: string;
  /** The part whose change matters — a verb and a path, a protocol, a schema. */
  fingerprint: string;
};

/** Who looked at a flow against the model, when, and what they were looking at. */
export type FlowValidationStamp = {
  checkedAt: string;
  checkedBy?: PersonRef;
  dependencies: FlowDependency[];
};

export type StoredDataFlow = {
  id: string;
  name: string;
  description?: string;
  steps: DataFlowStep[];
  /** Existing markdown docs on C4 entities, referenced by doc id. */
  documentationIds?: string[];
  /** Existing sequence diagrams on containers/components, referenced by diagram id. */
  sequenceIds?: string[];
  /** Auto-generated sequence diagram id for this flow (single, overwritten on regenerate). */
  magicSequenceId?: string;
  /** Fingerprint of flow steps when magic sequence was last generated. */
  magicSequenceSourceKey?: string;
  /** What the model looked like when somebody last confirmed this flow. */
  validation?: FlowValidationStamp;
  modelVersion: 1;
  createdAt: string;
  updatedAt: string;
  createdBy?: PersonRef;
  updatedBy?: PersonRef;
};

export type DataFlowExtras = {
  dataFlows?: StoredDataFlow[];
};

/** Markdown documentation stored server-side and/or inline on the model. */
export type StoredDocumentation = {
  id: string;
  projectId: string;
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  title: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: PersonRef;
  updatedBy?: PersonRef;
};

/** Inline doc payload kept on the C4 entity (local editor + starter template). */
export type InlineDocumentation = {
  id: string;
  title: string;
  markdown: string;
  updatedAt?: string;
  createdAt?: string;
  createdBy?: PersonRef;
  updatedBy?: PersonRef;
};

export type DocumentationExtras = {
  /**
   * All docs attached to this entity (preferred).
   * Legacy `documentation` / `documentationId` are kept in sync as the first item.
   */
  documentations?: InlineDocumentation[];
  /** @deprecated Prefer `documentations` */
  documentationId?: string;
  /** @deprecated Prefer `documentations` */
  documentation?: InlineDocumentation;
};

/** Who created / last edited an entity (snapshot of GitLab display name + username). */
export type PersonRef = {
  name: string;
  username: string;
};

export type AuditExtras = {
  createdBy?: PersonRef;
  updatedBy?: PersonRef;
  createdAt?: string;
  updatedAt?: string;
};

export function isExternalEntity(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  return Boolean((item as ExternalFlag).external);
}

export function isApiEndpoint(
  item: { kind?: string; endpoint?: string } | null | undefined
): boolean {
  if (item?.kind === 'channel') return false;
  return item?.kind === 'endpoint' || typeof item?.endpoint === 'string';
}

export const CHANNEL_PROTOCOLS = [
  'kafka',
  'amqp',
  'sqs',
  'nats',
  'redis-stream',
  'mqtt',
] as const;

export type ChannelProtocol = (typeof CHANNEL_PROTOCOLS)[number];

export const CHANNEL_SCHEMA_FORMATS = [
  'avro',
  'json-schema',
  'protobuf',
  'cloudevents',
] as const;

export type ChannelSchemaFormat = (typeof CHANNEL_SCHEMA_FORMATS)[number];

export const CHANNEL_COMPATIBILITY = [
  'backward',
  'forward',
  'full',
  'none',
] as const;

export type ChannelCompatibility = (typeof CHANNEL_COMPATIBILITY)[number];

export type ChannelSurface = 'Topic' | 'Queue' | 'Exchange' | 'Stream';

const CHANNEL_PROTOCOL_ALIASES: Record<string, ChannelProtocol> = {
  apachekafka: 'kafka',
  'apache-kafka': 'kafka',
  kafka: 'kafka',
  rabbitmq: 'amqp',
  rabbit: 'amqp',
  amqp: 'amqp',
  amazonsqs: 'sqs',
  sqs: 'sqs',
  nats: 'nats',
  redisstreams: 'redis-stream',
  'redis-streams': 'redis-stream',
  'redis_stream': 'redis-stream',
  'redis-stream': 'redis-stream',
  mqtt: 'mqtt',
};

export function normalizeChannelProtocol(
  raw: unknown,
  fallback: ChannelProtocol = 'kafka'
): ChannelProtocol {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  return CHANNEL_PROTOCOL_ALIASES[key] || fallback;
}

export function isChannelProtocol(value: string): value is ChannelProtocol {
  return (CHANNEL_PROTOCOLS as readonly string[]).includes(value);
}

export function normalizeChannelSchemaFormat(
  raw: unknown,
  fallback: ChannelSchemaFormat = 'avro'
): ChannelSchemaFormat {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (key === 'json' || key === 'jsonschema') return 'json-schema';
  if (key === 'proto' || key === 'proto3') return 'protobuf';
  if (key === 'ce' || key === 'cloud-event' || key === 'cloud-events') {
    return 'cloudevents';
  }
  return (CHANNEL_SCHEMA_FORMATS as readonly string[]).includes(key)
    ? (key as ChannelSchemaFormat)
    : fallback;
}

export function normalizeChannelCompatibility(
  raw: unknown
): ChannelCompatibility | undefined {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  return (CHANNEL_COMPATIBILITY as readonly string[]).includes(key)
    ? (key as ChannelCompatibility)
    : undefined;
}

/** Surface noun drawn on the card — topic vs queue vs exchange. */
export function channelSurfaceLabel(protocol?: string): ChannelSurface {
  const p = normalizeChannelProtocol(protocol);
  if (p === 'amqp') return 'Exchange';
  if (p === 'sqs') return 'Queue';
  if (p === 'redis-stream') return 'Stream';
  return 'Topic';
}

/**
 * A broker channel lives on the component layer next to endpoints, not as one.
 * The name is the topic/queue; produce/consume is a role on the edge.
 */
export type ChannelExtras = {
  kind?: 'channel';
  protocol?: ChannelProtocol | string;
  keySchema?: string;
  valueSchema?: string;
  schemaFormat?: ChannelSchemaFormat | string;
  headersSchema?: string;
  compatibility?: ChannelCompatibility | string;
};

export function isBrokerChannel(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  return (item as { kind?: string }).kind === 'channel';
}

/**
 * A screen, or one of its components. Sits on the component layer under its
 * front-end container, the way an endpoint sits under its service.
 *
 * `design` is a reference, never a picture: the pixels stay in the design tool
 * and are read when the work is done. What is kept is what the design tool
 * does not hold — the states someone decided must exist, and the version the
 * work was pinned against. `designSystem` is normally inherited from the
 * container and set here only when this element disagrees with it.
 */
export type UiExtras = {
  kind?: 'ui';
  /** Tagged text: `@design`, `@version`, `@props`, `@state`, `@tokens`, `@a11y`. */
  design?: string;
  designSystem?: string;
};

/** One value a design system holds — what an element cites in `@tokens`. */
export type DesignTokenRecord = {
  name: string;
  value?: string;
  type?: 'color' | 'space' | 'radius' | 'type' | 'shadow' | 'other';
  description?: string;
  /** How many places use it, when whoever read the system counted. */
  uses?: number;
};

/**
 * A named vocabulary a front end is built in. Part of the model, so it forks
 * with a branch and travels in a version: the values a change set was
 * implemented against are as pinned as the rest of it.
 */
export type DesignSystemRecord = {
  id: string;
  name: string;
  source?: { kind?: 'figma' | 'tokens-file' | 'code' | 'none'; ref?: string };
  tokens?: DesignTokenRecord[];
  readAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ModelWithDesignSystems = { designSystems?: DesignSystemRecord[] };

export function listDesignSystems(model: ModelWithDesignSystems | null | undefined): DesignSystemRecord[] {
  return model?.designSystems ?? [];
}

export function findDesignSystemByName(
  model: ModelWithDesignSystems | null | undefined,
  name: string | undefined
): DesignSystemRecord | null {
  if (!name?.trim()) return null;
  const wanted = name.trim().toLowerCase();
  return listDesignSystems(model).find((s) => s.name.trim().toLowerCase() === wanted) ?? null;
}

export function isUiElement(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const entity = item as { kind?: string; design?: unknown };
  if (entity.kind === 'ui') return true;
  return typeof entity.design === 'string' && entity.design.trim().length > 0;
}

/**
 * People and actors are a first-class element, not a technology choice: C4 draws
 * them with the person glyph regardless of what they are built with.
 */
/**
 * A link on an element, and the words to show for it.
 *
 * An element used to carry one bare `url`, which the card offered as a button
 * and the panel showed as the address itself — fine for a single link to a
 * repository, useless once there are three and you have to read hostnames to
 * tell a runbook from a dashboard. The label is what a person reads; the URL
 * is where it goes.
 */
/**
 * What a link is for. Four kinds, because four is what people actually attach
 * to a service and want to tell apart at a glance: where the code is, where
 * it is explained, where it is watched, and everything else.
 */
export const ELEMENT_LINK_KINDS = ['git', 'docs', 'observability', 'web'] as const;
export type ElementLinkKind = (typeof ELEMENT_LINK_KINDS)[number];

export type ElementLink = {
  url: string;
  label: string;
  /** Absent on links saved before kinds existed; guessed from the address then. */
  kind?: ElementLinkKind;
};

const GIT_HOST_RE =
  /^https?:\/\/([^/]*\.)?(github\.com|gitlab\.[^/]+|bitbucket\.org|codeberg\.org|gitea\.[^/]+|dev\.azure\.com|visualstudio\.com|sr\.ht|gitee\.com)(\/|$)/i;
const OBSERVABILITY_RE =
  /grafana|kibana|datadog|sentry|newrelic|prometheus|jaeger|zipkin|splunk|honeycomb|dynatrace|elastic|opensearch|signoz|loki|tempo|pagerduty|opsgenie|statuspage/i;
const DOCS_RE =
  /confluence|notion\.|wiki|docs?\.|readthedocs|swagger|redoc|openapi|storybook|readme|gitbook|mkdocs/i;

/**
 * The kind an address most likely is, for a link saved without one or for the
 * default while somebody is still typing. A guess and labelled as one: the
 * person picks, this only saves them the click when the host gives it away.
 */
export function guessLinkKind(url: string): ElementLinkKind {
  const text = String(url || '').trim();
  if (!text) return 'web';
  if (GIT_HOST_RE.test(text) || /\/-\/|\/_git\/|\.git(\/|$)/.test(text)) return 'git';
  if (OBSERVABILITY_RE.test(text)) return 'observability';
  if (DOCS_RE.test(text)) return 'docs';
  return 'web';
}

export function isElementLinkKind(value: unknown): value is ElementLinkKind {
  return typeof value === 'string' && (ELEMENT_LINK_KINDS as readonly string[]).includes(value);
}

export type LinkExtras = {
  links?: ElementLink[];
};

const LINK_LABEL_MAX = 30;
const LINK_URL_MAX = 2000;
const MAX_ELEMENT_LINKS = 5;

/** The host, as a stand-in label for a link that was saved before labels. */
export function labelFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).host || trimmed.slice(0, LINK_LABEL_MAX);
  } catch {
    return trimmed.replace(/^[a-z]+:\/\//i, '').split('/')[0].slice(0, LINK_LABEL_MAX);
  }
}

/**
 * Whether this is an address a browser could follow.
 *
 * Anything the URL parser accepts, which lets `mailto:` and an internal
 * `slack://` through, plus a host for http and https — `https://` on its own
 * parses and goes nowhere.
 *
 * The form refuses what this refuses. The sanitiser does not: it runs over
 * what is already stored and over imports, and an address someone saved years
 * ago being silently dropped for failing today's check is a worse outcome than
 * a link that does not resolve.
 */
export function isValidLinkUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return Boolean(parsed.hostname);
    }
    return true;
  } catch {
    return false;
  }
}

export function sanitizeLinks(raw: unknown): ElementLink[] {
  if (!Array.isArray(raw)) return [];
  const out: ElementLink[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const url = String((entry as ElementLink).url ?? '').trim().slice(0, LINK_URL_MAX);
    if (!url) continue;
    /* A link with no label of its own is named after where it points, rather
       than dropped — the address is still the thing someone saved. */
    const label =
      String((entry as ElementLink).label ?? '').trim().slice(0, LINK_LABEL_MAX) ||
      labelFromUrl(url);
    const kind = (entry as ElementLink).kind;
    out.push({ url, label, ...(isElementLinkKind(kind) ? { kind } : {}) });
    if (out.length >= MAX_ELEMENT_LINKS) break;
  }
  return out;
}

/**
 * Every link an element has, whichever way it was stored.
 *
 * An element saved before this existed has a bare `url` and no list, and it
 * keeps working: the address becomes the one link, labelled with its host. An
 * element with a list is read from the list, and its `url` is kept in step
 * with the first of them for everything that still reads a single address —
 * the linter, the clipboard, the MCP surface.
 */
export function getElementLinks(item: unknown): ElementLink[] {
  if (!item || typeof item !== 'object') return [];
  const record = item as LinkExtras & { url?: string };
  const listed = sanitizeLinks(record.links);
  if (listed.length) return listed;
  const legacy = String(record.url ?? '').trim();
  return legacy ? [{ url: legacy, label: labelFromUrl(legacy) }] : [];
}

export { MAX_ELEMENT_LINKS, LINK_LABEL_MAX };

export type PersonExtras = {
  kind?: 'person';
};

export function isPersonEntity(
  item: { kind?: string } | null | undefined
): boolean {
  return item?.kind === 'person';
}

export const TABLE_DATA_TYPES = [
  'uuid',
  'text',
  'int',
  'bigint',
  'bool',
  'timestamptz',
  'date',
  'numeric',
  'jsonb',
] as const;

export type TableDataType = (typeof TABLE_DATA_TYPES)[number];
