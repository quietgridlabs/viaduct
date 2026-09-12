import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

export type ThreadColor = 'yellow' | 'red' | 'green' | 'purple';

export type ProjectThread = {
  id: string;
  x: number;
  y: number;
  title: string;
  status: 'open' | 'resolved';
  color: ThreadColor;
  /** canvas = diagram pin; merge_review = branch merge discussion */
  context?: 'canvas' | 'merge_review';
  view_level: ElementLevel;
  active_system_id: string | null;
  active_container_id: string | null;
  active_component_id: string | null;
  created_at: string;
  created_by_username: string;
  created_by_name: string | null;
  created_by_avatar: string | null;
  comment_count: number;
  first_body: string | null;
};

export type ThreadComment = {
  id: string;
  body: string;
  mentions: string;
  created_at: string;
  created_by_username: string;
  created_by_name: string | null;
  created_by_avatar: string | null;
};

export type User = {
  id: string;
  gitlab_id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  email?: string | null;
  has_gitlab_token?: boolean;
  kind?: 'gitlab' | 'google' | 'github' | 'guest';
};

/** Which sign-in providers this deployment is configured for. */
export type AuthProviders = {
  gitlab: boolean;
  google: boolean;
  github: boolean;
};

export type ProjectAccess = 'owner' | 'edit' | 'view';

export type ProjectFolder = {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  folder_id?: string | null;
  description?: string | null;
  version_name_pattern?: string | null;
  /** A shape branch names must take, when the project asks for one. */
  branch_name_pattern?: string | null;
  /** Direct edits refused: the model changes by merging a branch. */
  trunk_protected?: boolean;
  /** How many merge approvals a branch needs. 0 = no gate. */
  merge_required_approvals?: number;
  created_at: string;
  updated_at: string;
  access?: ProjectAccess;
  mine?: boolean;
  owner_username?: string;
  owner_name?: string;
};

export type Project = ProjectSummary & {
  model: Record<string, unknown>;
  /** Tags the project has named but nothing carries yet. */
  declared_tags?: string[];
  owner_id?: string;
  owner_avatar?: string | null;
};

export type ProjectShare = {
  id: string;
  project_id: string;
  gitlab_group_id: string | null;
  gitlab_user_id: string | null;
  role: 'view' | 'edit';
  created_by: string;
  created_at: string;
  label?: string | null;
};

export type ProjectShareLink = {
  id: string;
  project_id: string;
  role: 'view' | 'edit';
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  url: string | null;
  active: boolean;
  hint?: string;
};

export type GitlabGroup = {
  id: string;
  name: string;
  full_path: string;
  avatar_url: string | null;
};

export type GitlabUser = {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
};

export type ProjectActivity = {
  id: string;
  action: string;
  target: string | null;
  detail: string | null;
  ref_id: string | null;
  created_at: string;
  user_username: string | null;
  user_name: string | null;
  user_avatar: string | null;
};

export type ProjectSnapshot = {
  id: string;
  label: string;
  name: string | null;
  description: string | null;
  pinned: 0 | 1;
  created_at: string;
  created_by_username: string;
  created_by_name: string | null;
};

export type PendingChanges = {
  since: { id: string; name: string | null; created_at: string } | null;
  totals: { added: number; removed: number; changed: number; moved: number } | null;
  empty: boolean;
};

export type FieldChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type ElementLevel = 'system' | 'container' | 'component' | 'code';

export type ElementRef = {
  id: string;
  level: ElementLevel;
  name: string;
  systemId?: string;
  containerId?: string;
  componentId?: string;
  position: { x: number; y: number };
  technology?: string;
  external: boolean;
  kind?: string;
};

export type ElementChange = ElementRef & { previousName: string; fields: FieldChange[] };

export type ConnectionRef = {
  key: string;
  sourceId: string;
  targetId: string;
  level: ElementLevel;
  sourceName: string;
  targetName: string;
  label: string;
};

export type ConnectionChange = ConnectionRef & { fields: FieldChange[] };

export type FlowRef = { id: string; name: string; steps: number };

export type FlowChange = FlowRef & {
  previousName: string;
  previousSteps: number;
  fields: FieldChange[];
};

export type FlowStepRef = {
  id: string;
  index: number;
  step: unknown;
};

export type FlowStepChange = {
  id: string;
  indexBefore: number;
  indexAfter: number;
  fields: FieldChange[];
};

export type FlowStepMoved = {
  id: string;
  indexBefore: number;
  indexAfter: number;
  fields?: FieldChange[];
};

export type FlowAlignmentRow = {
  before: number | null;
  after: number | null;
  status: 'same' | 'changed' | 'added' | 'removed' | 'moved';
};

export type FlowParticipants = {
  added: ElementRef[];
  removed: ElementRef[];
  changed: ElementChange[];
  moved: ElementRef[];
};

/** Per-step diff of one Magic flow — payload of `subject=flow:<id>`. */
export type FlowDiff = {
  id: string | null;
  name: string;
  previousName: string;
  fields: FieldChange[];
  steps: {
    added: FlowStepRef[];
    removed: FlowStepRef[];
    changed: FlowStepChange[];
    moved: FlowStepMoved[];
  };
  alignment: FlowAlignmentRow[];
  participants: FlowParticipants;
  reordered: boolean;
  empty: boolean;
};

export type CompareRef = {
  projectId: string;
  /** `current`, a snapshot id, or `fork_point` on a branch. */
  ref: string;
};

export type CompareSideKind = 'current' | 'version' | 'branch' | 'fork_point';

export type CompareSideMeta = {
  projectId: string;
  ref: string;
  label: string;
  kind: CompareSideKind;
  meta: Record<string, unknown>;
};

export type CompareElementPayload = {
  before: (Record<string, unknown> & { level: ElementLevel }) | null;
  after: (Record<string, unknown> & { level: ElementLevel }) | null;
  fields: FieldChange[];
  level: ElementLevel;
  parents: {
    systemId?: string;
    containerId?: string;
    componentId?: string;
  };
};

export type CompareResult = {
  left: CompareSideMeta;
  right: CompareSideMeta;
  diff: ProjectDiff;
  flow?: FlowDiff;
  element?: CompareElementPayload;
};

export type CompareSubject = 'project' | `element:${string}` | `flow:${string}`;

export type SequenceRef = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerLevel: ElementLevel;
  source: string;
};

export type SequenceChange = Omit<SequenceRef, 'source'> & {
  previousName: string;
  before: string;
  after: string;
};

export type DocRef = {
  id: string;
  title: string;
  ownerId: string;
  ownerType: ElementLevel;
};

export type DocAdded = DocRef & { after: string };
export type DocRemoved = DocRef & { before: string };
export type DocChanged = DocRef & { previousTitle: string; before: string; after: string };

export type ProjectDiff = {
  elements: { added: ElementRef[]; removed: ElementRef[]; changed: ElementChange[] };
  connections: { added: ConnectionRef[]; removed: ConnectionRef[]; changed: ConnectionChange[] };
  flows: { added: FlowRef[]; removed: FlowRef[]; changed: FlowChange[] };
  sequences: { added: SequenceRef[]; removed: SequenceRef[]; changed: SequenceChange[] };
  docs: { added: DocAdded[]; removed: DocRemoved[]; changed: DocChanged[] };
  moved: ElementRef[];
  totals: { added: number; removed: number; changed: number; moved: number };
  empty: boolean;
};

export type ChangeSetCriterion = {
  id: string;
  text: string;
  position: number;
  status: 'pending' | 'done';
};

export type ChangeSetProgress = {
  id: string;
  criterion_id: string | null;
  summary: string;
  ref: string | null;
  actor: string | null;
  created_at: string;
};

export type ChangeSetConstraints = {
  language?: string;
  framework?: string;
  persistence?: string;
  reliability?: string[];
  forbidden?: string[];
  [key: string]: unknown;
};

export type ChangeSetStatus =
  | 'draft'
  | 'ready'
  | 'implementing'
  | 'update_documentation'
  | 'done';

export type ChangeSet = {
  id: string;
  project_id: string;
  revision_id: string;
  revision_name?: string | null;
  revision_created_at?: string | null;
  /** A short name for the list. The work itself is described by `intent`. */
  title?: string | null;
  intent: string;
  status: ChangeSetStatus;
  scope: string[];
  constraints: ChangeSetConstraints;
  base_code_ref: string | null;
  update_documentation: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  criteria: ChangeSetCriterion[];
  progress: ChangeSetProgress[];
};

/** One UI element whose design moved after the change set was pinned to it. */
export type DesignDriftEntry = {
  id: string;
  name: string;
  system: string | null;
  /** `node` · `version` · `states` · `system` · `gone`. */
  changes: string[];
  pinned: { system: string | null; node: string; version: string; states: { name: string; note: string }[] };
  current: { system: string | null; node: string; version: string; states: { name: string; note: string }[] } | null;
};

export type ChangeSetInput = {
  title?: string | null;
  intent: string;
  revisionId: string;
  scope?: string[];
  constraints?: ChangeSetConstraints;
  baseCodeRef?: string | null;
  criteria?: string[];
  updateDocumentation?: boolean;
};

export type SnapshotDetail = {
  snapshot: ProjectSnapshot;
  model: FlatC4Model;
  docs: ProjectDocumentation[];
};

export type ProjectDocumentation = {
  id: string;
  project_id: string;
  owner_type: 'system' | 'container' | 'component' | 'code';
  owner_id: string;
  title: string;
  markdown: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_by_name?: string | null;
  created_by_username?: string | null;
  updated_by_name?: string | null;
  updated_by_username?: string | null;
};

export type RenderFormat = 'svg' | 'png';

export type OpenApiDocumentResponse = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, unknown>>;
} & Record<string, unknown>;

export type OpenApiBuildRequest = {
  endpoints: unknown[];
  meta: { title: string; version?: string; description?: string };
  stored?: string;
};

export type OpenApiImportedEndpoint = {
  path: string;
  method: string;
  name: string;
  description: string;
  tags: string[];
  request: unknown;
  response: unknown;
  channel?: boolean;
};

export type RenderDiagramRequest = {
  model: unknown;
  view: { viewLevel?: string; activeSystemId?: string; activeContainerId?: string; activeComponentId?: string };
  theme: 'light' | 'dark';
  technologies: Record<string, { id: string; name: string; color: string; database: boolean }>;
  format: RenderFormat;
  filename?: string;
};

export type RenderSequenceRequest = {
  model: unknown;
  name?: string;
  theme: 'light' | 'dark';
  format: RenderFormat;
  filename?: string;
};

export type SupportTopic = 'question' | 'bug' | 'idea' | 'other';

export type SupportPayload = {
  name: string;
  email: string;
  topic: SupportTopic;
  message: string;
  source?: string;
  website?: string;
};

export type AccessRequestPayload = {
  name: string;
  email: string;
  company?: string;
  gitlabUsername?: string;
  message?: string;
  source?: string;
  website?: string;
};

export type ApiTokenScope = 'read' | 'write';

export type ApiTokenSummary = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  /** Comma-separated, as stored: `read` or `read,write`. */
  scopes?: string;
};

export type ApiTokenStatus = {
  tokens: ApiTokenSummary[];
  exists: boolean;
  createdAt: string | null;
  allowed: boolean;
};

/**
 * Somebody's Figma access, as settings shows it.
 *
 * `lastError` is what Figma last said — an expired token is the common one,
 * and without this it would show up only as design versions quietly no longer
 * being stamped.
 */
export type FigmaConnection = {
  connected: boolean;
  handle?: string | null;
  connectedAt?: string;
  lastUsedAt?: string | null;
  lastError?: string | null;
  /**
   * Deadlines Figma gave, by which budget they apply to — `content` (frames
   * and whole files), `meta` (a file's date and name) or `images`. Separate
   * because the allowances are: frames can be out of reach for days while
   * every design link still gets its date stamped.
   */
  paused?: { content?: string; meta?: string; images?: string };
  /**
   * `low` on a view-only Figma seat, where reading files is budgeted per month
   * rather than per minute. Worth saying out loud: without it a person spends
   * their time looking for a fault on our side.
   */
  limitType?: string;
  planTier?: string;
  upgradeLink?: string;
  allowed?: boolean;
};

/** One value found in a design file, or offered as a name for one. */
export type DesignValueRecord = {
  name: string;
  value: string;
  type?: 'color' | 'space' | 'radius' | 'type' | 'shadow' | 'other';
  description?: string;
  /** Suggestions only: how many layers carry this value, and a few of them. */
  uses?: number;
  where?: string[];
};

/**
 * What a design system's own file holds.
 *
 * Two halves on purpose: `tokens` come from styles somebody named in the file,
 * so their names are already the vocabulary; `suggestions` are values nobody
 * named, carrying a proposed name that is a guess and meant to be edited.
 */
export type DesignSystemValues = {
  system: string;
  file: { key: string; name: string; lastModified: string };
  tokens: DesignValueRecord[];
  suggestions: DesignValueRecord[];
  truncated?: boolean;
  readAt: string;
};

/** One layer of a design node, with the values it carries. */
export type DesignNodeLayer = {
  path: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  radius?: string;
  opacity?: number;
  text?: string;
  font?: string;
};

export type FigmaDesignNode = {
  element: { id: string; name: string };
  system: string | null;
  file: { key: string; name: string; lastModified: string };
  node: { id: string; name: string; type: string; width?: number; height?: number };
  href: string;
  layers: DesignNodeLayer[];
  values: Record<string, DesignValueRecord[]>;
  truncated?: boolean;
  pinnedTo?: string;
  behind?: boolean;
  /** A URL that expires within the hour. Never stored. */
  image?: { url: string; note: string };
  readAt: string;
};

export type DomainMapElement = {
  domainId: string;
  name: string;
  level: 'system' | 'container';
  color?: string;
  /** What the domain is for, as written in the manager. */
  description?: string;
  /** Systems or containers living in it — a domain's weight on the map. */
  elementCount?: number;
  projectId: string;
  projectName: string;
  /** A container-level domain whose containers all sit under systems in this
      system-level domain — nested under it on the map, not drawn separately. */
  parentDomainId?: string;
};

/** One entry per pair of domains, carrying the traffic in both directions. */
export type DomainMapEdge = {
  fromDomainId: string;
  toDomainId: string;
  connections?: number;
  reverseConnections?: number;
  bidirectional?: boolean;
};

export type DomainElement = {
  id: string;
  name: string;
  type: 'system' | 'container';
  technology: string;
  projectId: string;
  projectName: string;
  domainId: string;
  domainName: string;
  description?: string;
  systemId?: string;
};

export type WorkspaceSearchElement = {
  id: string;
  name: string;
  type: 'system' | 'container';
  technology: string;
  projectId: string;
  projectName: string;
  domainId: string;
  domainName: string;
};

export type ProjectElement = Record<string, unknown> & {
  id: string;
  type: string;
  name?: string;
  domainId?: string;
  domain?: { id: string; name: string; level: string } | null;
  systemName?: string;
};
