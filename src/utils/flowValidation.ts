import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type {
  DataFlowStep,
  FlowDependency,
  FlowParticipantRef,
  FlowValidationStamp,
  StoredDataFlow,
} from '@/types/c4Extensions';

export type { FlowDependency, FlowValidationStamp };

/**
 * Whether a Magic flow still describes the model it was drawn on.
 *
 * A flow is a path through elements, contracts and connections, and none of
 * those hold still: an endpoint changes its verb, a service is replaced, a
 * connection is redrawn. The flow keeps playing regardless, which is the worst
 * outcome — a confident walk through a system that no longer works that way.
 *
 * Two questions are answered here, and they are different questions:
 *
 *   1. Is anything the flow refers to *gone*? That needs no history: resolve
 *      every reference against the model in front of us. Always available,
 *      including for flows saved long before this file existed.
 *   2. Has anything the flow refers to *changed since somebody last looked*?
 *      That needs a record of what it looked like then — the fingerprints
 *      stored on the flow when it was marked checked.
 *
 * Nothing here decides anything. A changed contract may be perfectly fine for
 * this flow, and only the person who owns it knows; the job of this file is to
 * put the change in front of them.
 */

export type FlowDependencyKind = FlowDependency['kind'];

export type FlowIssueKind =
  | 'missing'
  | 'missing_link'
  | 'incomplete'
  | 'changed'
  | 'renamed'
  | 'unverifiable';

export type FlowIssue = {
  key: string;
  kind: FlowIssueKind;
  dependencyKind: FlowDependencyKind;
  /** Steps that lean on it — where to go to fix this. */
  stepIds: string[];
  name: string;
  /** What it was, when we know: only a stamp can tell us. */
  before?: string;
  after?: string;
  severity: 'broken' | 'review' | 'cosmetic';
};

export type FlowStatus = 'ok' | 'unchecked' | 'review' | 'broken';

export type FlowValidation = {
  status: FlowStatus;
  issues: FlowIssue[];
  /** What the flow leans on right now — what a "mark checked" would store. */
  dependencies: FlowDependency[];
  checkedAt?: string;
};

type IndexedElement = {
  id: string;
  name: string;
  kind: FlowDependencyKind;
  fingerprint: string;
};

export type ModelIndex = {
  elements: Map<string, IndexedElement>;
  /** `src>tgt` → what crosses, so a redrawn connection is not a silent one. */
  connections: Map<string, { name: string; fingerprint: string }>;
};

type AnyElement = Record<string, unknown> & {
  id?: unknown;
  name?: unknown;
  connections?: unknown;
};

const str = (value: unknown) => (typeof value === 'string' ? value : '');

function contractFingerprint(element: AnyElement): { kind: FlowDependencyKind; fingerprint: string } {
  if (element.kind === 'endpoint') {
    return {
      kind: 'endpoint',
      /* Verb, path and the shape of what goes in and out. A description change
         is not a contract change; a status code is. */
      fingerprint: [
        str(element.method).toUpperCase(),
        str(element.endpoint),
        str(element.request),
        str(element.response),
        str(element.headers),
      ].join('|'),
    };
  }
  if (element.kind === 'channel') {
    return {
      kind: 'channel',
      fingerprint: [
        str(element.protocol),
        str(element.schemaFormat),
        str(element.keySchema),
        str(element.valueSchema),
        str(element.headersSchema),
        str(element.compatibility),
      ].join('|'),
    };
  }
  /* For a plain element the technology is the part a flow depends on: a
     service that became a queue is not the same participant. */
  return { kind: 'element', fingerprint: str(element.technology) };
}

/**
 * One pass over the model, so checking a step is a pair of lookups.
 *
 * Build it once per model and share it between the list and the editor —
 * measured, the pass is the whole cost, and the steps are free.
 */
export function buildModelIndex(model: FlatC4Model | null | undefined): ModelIndex {
  const elements = new Map<string, IndexedElement>();
  const connections = new Map<string, { name: string; fingerprint: string }>();
  if (!model) return { elements, connections };

  const lists = [model.systems, model.containers, model.components, model.codeElements];
  for (const list of lists) {
    for (const raw of (list ?? []) as unknown as AnyElement[]) {
      const id = str(raw.id);
      if (!id) continue;
      const { kind, fingerprint } = contractFingerprint(raw);
      elements.set(id, { id, name: str(raw.name), kind, fingerprint });
    }
  }

  for (const list of lists) {
    for (const raw of (list ?? []) as unknown as AnyElement[]) {
      const sourceId = str(raw.id);
      if (!sourceId) continue;
      for (const conn of (raw.connections ?? []) as Record<string, unknown>[]) {
        const targetId = str(conn.targetId);
        if (!targetId) continue;
        const source = elements.get(sourceId)?.name || sourceId;
        const target = elements.get(targetId)?.name || targetId;
        connections.set(`${sourceId}>${targetId}`, {
          name: `${source} → ${target}`,
          fingerprint: [str(conn.label), str(conn.technology)].join('|'),
        });
      }
    }
  }

  return { elements, connections };
}

/** Every reference the flow makes, with the steps that make it. */
function referencesOf(flow: StoredDataFlow): Map<string, { kind: FlowDependencyKind; id: string; stepIds: string[]; external?: FlowParticipantRef }> {
  const refs = new Map<
    string,
    { kind: FlowDependencyKind; id: string; stepIds: string[]; external?: FlowParticipantRef }
  >();

  const add = (key: string, kind: FlowDependencyKind, id: string, stepId: string, external?: FlowParticipantRef) => {
    const found = refs.get(key);
    if (found) {
      if (!found.stepIds.includes(stepId)) found.stepIds.push(stepId);
      return;
    }
    refs.set(key, { kind, id, stepIds: [stepId], external });
  };

  const participant = (ref: FlowParticipantRef | undefined, stepId: string) => {
    if (!ref?.id) return;
    /* A participant in another project is a name we were handed, not something
       we can look up: it gets reported as unverifiable rather than missing. */
    if (ref.projectId) add(`ex:${ref.id}`, 'external', ref.id, stepId, ref);
    else add(`el:${ref.id}`, 'element', ref.id, stepId);
  };

  for (const step of flow.steps ?? []) {
    const stepId = step.id;
    if ((step as DataFlowStep).kind === 'link') continue;
    participant(step.from, stepId);
    participant(step.to, stepId);
    for (const id of step.endpointIds ?? []) add(`ep:${id}`, 'endpoint', id, stepId);
    for (const id of step.channelIds ?? []) add(`ch:${id}`, 'channel', id, stepId);
    for (const conn of step.connections ?? []) {
      if (!conn.sourceId || !conn.targetId) continue;
      add(`cn:${conn.sourceId}>${conn.targetId}`, 'connection', `${conn.sourceId}>${conn.targetId}`, stepId);
    }
  }

  return refs;
}

function resolve(
  kind: FlowDependencyKind,
  id: string,
  index: ModelIndex
): { name: string; fingerprint: string } | null {
  if (kind === 'connection') {
    const found = index.connections.get(id);
    return found ? { name: found.name, fingerprint: found.fingerprint } : null;
  }
  const found = index.elements.get(id);
  if (!found) return null;
  /* The reference says what it expected to find; the model says what is there.
     A step pointing at an endpoint id that now names a container is as broken
     as one pointing at nothing. */
  if (kind === 'endpoint' && found.kind !== 'endpoint') return null;
  if (kind === 'channel' && found.kind !== 'channel') return null;
  return { name: found.name, fingerprint: found.fingerprint };
}

/**
 * A name for something that is not there any more.
 *
 * With a stamp we know what it was called. Without one — the common case for a
 * flow drawn before any of this existed — a connection can still be named from
 * its two ends, which is the difference between "connection gone" and a line
 * of raw uuids nobody can act on.
 */
function fallbackName(kind: FlowDependencyKind, id: string, index: ModelIndex): string {
  if (kind !== 'connection') return index.elements.get(id)?.name || id;
  const [sourceId, targetId] = id.split('>');
  const source = index.elements.get(sourceId)?.name;
  const target = index.elements.get(targetId)?.name;
  return source && target ? `${source} → ${target}` : id;
}

/** What the flow leans on as the model stands now — the stamp a check writes. */
export function flowDependencies(flow: StoredDataFlow, index: ModelIndex): FlowDependency[] {
  const out: FlowDependency[] = [];
  for (const [key, ref] of referencesOf(flow)) {
    if (ref.kind === 'external') {
      out.push({ key, kind: 'external', name: ref.external?.name || ref.id, fingerprint: 'external' });
      continue;
    }
    const current = resolve(ref.kind, ref.id, index);
    if (!current) continue;
    out.push({ key, kind: ref.kind, name: current.name, fingerprint: current.fingerprint });
  }
  return out;
}

/**
 * What a step claims by existing, beyond the ids it stores.
 *
 * A hop says "this goes from A to B". Most steps record no connection id at
 * all — the editor lets you pick two participants and leave it at that — so
 * checking only the stored references misses the case that matters most:
 * somebody deletes the arrow between A and B, and the flow still plays as if
 * it were there.
 *
 * The check is deliberately narrow, because a false alarm here costs more than
 * a missed one:
 *
 *   - only when both ends sit on the same C4 level, since a hop from a system
 *     to a container crosses levels where no connection can exist;
 *   - either direction counts: a response travels back along the arrow that
 *     carried the request;
 *   - a hop from something to itself is not a connection and never was.
 */
function stepIssues(flow: StoredDataFlow, index: ModelIndex): FlowIssue[] {
  const issues: FlowIssue[] = [];

  for (const step of flow.steps ?? []) {
    if ((step as DataFlowStep).kind === 'link') continue;
    const from = step.from;
    const to = step.to;
    const fromId = from?.id ?? '';
    const toId = to?.id ?? '';

    /* One end filled and the other not: a hop that goes nowhere. Both ends
       empty is a step nobody has started, which is not a fault. */
    if (Boolean(fromId) !== Boolean(toId)) {
      issues.push({
        key: `st:${step.id}`,
        kind: 'incomplete',
        dependencyKind: 'element',
        stepIds: [step.id],
        name: step.name || index.elements.get(fromId || toId)?.name || '',
        severity: 'broken',
      });
      continue;
    }

    if (!fromId || !toId || fromId === toId) continue;
    if (from?.projectId || to?.projectId) continue;
    if (from?.type !== to?.type) continue;
    if (!index.elements.has(fromId) || !index.elements.has(toId)) continue;

    if (index.connections.has(`${fromId}>${toId}`) || index.connections.has(`${toId}>${fromId}`)) {
      continue;
    }

    const key = `lk:${fromId}>${toId}`;
    const found = issues.find((issue) => issue.key === key);
    if (found) {
      if (!found.stepIds.includes(step.id)) found.stepIds.push(step.id);
      continue;
    }

    issues.push({
      key,
      kind: 'missing_link',
      dependencyKind: 'connection',
      stepIds: [step.id],
      name: `${index.elements.get(fromId)?.name || fromId} → ${index.elements.get(toId)?.name || toId}`,
      severity: 'broken',
    });
  }

  return issues;
}

/**
 * The flow's standing: what is gone, and what moved since it was last checked.
 *
 * `stamp` is optional on purpose. Without one the answer is still useful — it
 * is question 1 — and the flow reads as "not checked yet" rather than as
 * broken, which is what every flow saved before this feature deserves.
 */
export function validateFlow(
  flow: StoredDataFlow,
  index: ModelIndex,
  stamp?: FlowValidationStamp | null
): FlowValidation {
  const issues: FlowIssue[] = [];
  const stored = new Map((stamp?.dependencies ?? []).map((dep) => [dep.key, dep]));

  for (const [key, ref] of referencesOf(flow)) {
    if (ref.kind === 'external') {
      issues.push({
        key,
        kind: 'unverifiable',
        dependencyKind: 'external',
        stepIds: ref.stepIds,
        name: ref.external?.name || ref.id,
        severity: 'cosmetic',
      });
      continue;
    }

    const current = resolve(ref.kind, ref.id, index);
    const was = stored.get(key);

    if (!current) {
      issues.push({
        key,
        kind: 'missing',
        dependencyKind: ref.kind,
        stepIds: ref.stepIds,
        name: was?.name || fallbackName(ref.kind, ref.id, index),
        before: was?.fingerprint,
        severity: 'broken',
      });
      continue;
    }

    if (!was) continue;

    if (was.fingerprint !== current.fingerprint) {
      issues.push({
        key,
        kind: 'changed',
        dependencyKind: ref.kind,
        stepIds: ref.stepIds,
        name: current.name,
        before: was.fingerprint,
        after: current.fingerprint,
        severity: 'review',
      });
      continue;
    }

    if (was.name !== current.name) {
      /* Not silence: a rename sometimes is a change of meaning. But it never
         breaks a flow on its own, so it does not colour the badge. */
      issues.push({
        key,
        kind: 'renamed',
        dependencyKind: ref.kind,
        stepIds: ref.stepIds,
        name: current.name,
        before: was.name,
        after: current.name,
        severity: 'cosmetic',
      });
    }
  }

  issues.push(...stepIssues(flow, index));

  const broken = issues.some((issue) => issue.severity === 'broken');
  const review = issues.some((issue) => issue.severity === 'review');
  const status: FlowStatus = broken ? 'broken' : review ? 'review' : stamp ? 'ok' : 'unchecked';

  return {
    status,
    issues,
    dependencies: flowDependencies(flow, index),
    checkedAt: stamp?.checkedAt,
  };
}

/** Counts for the list badge, without rendering every flow's issues. */
export function summarizeFlowStatuses(statuses: FlowStatus[]) {
  return {
    broken: statuses.filter((s) => s === 'broken').length,
    review: statuses.filter((s) => s === 'review').length,
    unchecked: statuses.filter((s) => s === 'unchecked').length,
  };
}
