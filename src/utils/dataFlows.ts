import type { FlatC4Model, ViewLevel } from '@archivisio/c4-modelizer-sdk';
import type {
  DataFlowConnectionRef,
  DataFlowExtras,
  DataFlowStep,
  FlowBranchKind,
  FlowDependency,
  FlowValidationStamp,
  FlowContinuationRef,
  FlowOwnerType,
  FlowParticipantRef,
  StoredDataFlow,
} from '@/types/c4Extensions';
import { channelSurfaceLabel, isApiEndpoint, isBrokerChannel } from '@/types/c4Extensions';
import { isDatabaseTechnology } from './databaseTech';
import type { NeighborhoodHighlight } from './neighborhoodHighlight';
import type { DiagramFocusTarget } from './serviceCatalog';

const OWNER_TYPES: FlowOwnerType[] = ['system', 'container', 'component', 'code'];

export type DataFlowParticipation = {
  flow: StoredDataFlow;
  step: DataFlowStep;
  stepIndex: number;
  side: 'from' | 'to' | 'endpoint' | 'channel' | 'connection';
};

export type FlowParticipantOption = {
  id: string;
  type: FlowOwnerType;
  name: string;
  label: string;
  group: string;
  detail?: string;
};

export type FlowConnectionOption = {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  label?: string;
  level: FlowOwnerType;
};

type Ancestry = {
  id: string;
  type: FlowOwnerType;
  name: string;
  systemId?: string;
  containerId?: string;
  componentId?: string;
};

type BlockLike = {
  id: string;
  name?: string;
  connections?: { targetId: string; label?: string }[];
  original?: unknown;
  systemId?: string;
  containerId?: string;
  componentId?: string;
  kind?: string;
  endpoint?: string;
  method?: string;
};

type FlowModelCache = {
  systemsById: Map<string, BlockLike>;
  containersById: Map<string, BlockLike>;
  componentsById: Map<string, BlockLike>;
  participantOptions: FlowParticipantOption[];
  participantNamesById: Map<string, string>;
};

const flowModelCache = new WeakMap<FlatC4Model, FlowModelCache>();

function getFlowModelCache(model: FlatC4Model): FlowModelCache {
  const cached = flowModelCache.get(model);
  if (cached) return cached;

  const systemsById = new Map<string, BlockLike>();
  for (const s of model.systems as unknown as BlockLike[]) systemsById.set(s.id, s);

  const containersById = new Map<string, BlockLike>();
  for (const c of model.containers as unknown as BlockLike[]) containersById.set(c.id, c);

  const componentsById = new Map<string, BlockLike>();
  for (const c of model.components as unknown as BlockLike[]) componentsById.set(c.id, c);

  const participantOptions: FlowParticipantOption[] = [];
  for (const s of model.systems) {
    if (isClone(s)) continue;
    participantOptions.push({
      id: s.id,
      type: 'system',
      name: s.name,
      label: s.name,
      group: 'Systems',
    });
  }
  for (const c of model.containers) {
    if (isClone(c)) continue;
    const sys = systemsById.get(c.systemId);
    participantOptions.push({
      id: c.id,
      type: 'container',
      name: c.name,
      label: c.name,
      group: isDatabaseTechnology(c.technology) ? 'Databases' : 'Containers',
      detail: sys?.name,
    });
  }
  for (const c of model.components) {
    if (isClone(c)) continue;
    const container = containersById.get(c.containerId);
    const extras = c as typeof c & { method?: string; endpoint?: string; kind?: string };
    const isEp = isApiEndpoint(extras);
    const isCh = isBrokerChannel(extras);
    const name = isEp
      ? `${extras.method || '*'} ${extras.endpoint || c.name}`
      : isCh
        ? `${channelSurfaceLabel((extras as { protocol?: string }).protocol)} ${c.name}`
        : c.name;
    participantOptions.push({
      id: c.id,
      type: 'component',
      name: c.name,
      label: name,
      group: container?.name || 'Components',
      detail: isEp ? 'Endpoint' : isCh ? 'Channel' : undefined,
    });
  }
  for (const c of model.codeElements) {
    if (isClone(c)) continue;
    const component = componentsById.get(c.componentId);
    participantOptions.push({
      id: c.id,
      type: 'code',
      name: c.name,
      label: c.name,
      group: component ? `Code / ${component.name}` : 'Code',
    });
  }

  const sortedParticipants = sortByGroupThenLabel(participantOptions);
  const participantNamesById = new Map<string, string>();
  for (const opt of sortedParticipants) participantNamesById.set(opt.id, opt.name);

  const next = {
    systemsById,
    containersById,
    componentsById,
    participantOptions: sortedParticipants,
    participantNamesById,
  };
  flowModelCache.set(model, next);
  return next;
}

function isClone(item: { original?: unknown } | null | undefined): boolean {
  return Boolean(item && item.original);
}

const LABEL_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function sortByGroupThenLabel<T extends { group?: string; label: string }>(items: T[]): T[] {
  const groupOrder: string[] = [];
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const group = item.group || '';
    const list = grouped.get(group);
    if (list) {
      list.push(item);
      continue;
    }
    grouped.set(group, [item]);
    groupOrder.push(group);
  }
  const out: T[] = [];
  for (const group of groupOrder) {
    const list = grouped.get(group)!;
    list.sort((a, b) => LABEL_COLLATOR.compare(a.label, b.label));
    out.push(...list);
  }
  return out;
}

function asFlowsModel(model: FlatC4Model): DataFlowExtras {
  return model as FlatC4Model & DataFlowExtras;
}

export function participantKey(ref: FlowParticipantRef | null | undefined): string {
  if (!ref?.id || !ref.type) return '';
  return `${ref.type}:${ref.id}`;
}

export function parseParticipantKey(raw: string): FlowParticipantRef | null {
  const idx = raw.indexOf(':');
  if (idx <= 0) return null;
  const type = raw.slice(0, idx) as FlowOwnerType;
  const id = raw.slice(idx + 1);
  if (!OWNER_TYPES.includes(type) || !id) return null;
  return { id, type };
}

export function newDataFlowId(): string {
  return `flow_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function newDataFlowStepId(): string {
  return `step_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function newParallelGroupId(): string {
  return `pgrp_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function newBranchArmId(): string {
  return `arm_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

function sanitizeParallelGroupId(raw: unknown): string | undefined {
  const id = String(raw || '').trim().slice(0, 80);
  return id || undefined;
}

/** Anything unrecognised — including flows stored before OR existed — is AND. */
function sanitizeBranchKind(raw: unknown): FlowBranchKind {
  return raw === 'alternative' ? 'alternative' : 'parallel';
}

function sanitizeParticipant(raw: unknown): FlowParticipantRef {
  const rec = raw && typeof raw === 'object' ? (raw as FlowParticipantRef) : null;
  const type = OWNER_TYPES.includes(rec?.type as FlowOwnerType)
    ? (rec!.type as FlowOwnerType)
    : 'container';
  const projectId =
    typeof rec?.projectId === 'string' && rec.projectId.trim()
      ? rec.projectId.trim()
      : undefined;
  const str = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
  return {
    id: String(rec?.id || ''),
    type,
    ...(projectId
      ? {
          projectId,
          ...(str(rec?.name, 200) ? { name: str(rec?.name, 200) } : {}),
          ...(str(rec?.projectName, 200) ? { projectName: str(rec?.projectName, 200) } : {}),
          ...(str(rec?.domainId, 80) ? { domainId: str(rec?.domainId, 80) } : {}),
          ...(str(rec?.domainName, 200) ? { domainName: str(rec?.domainName, 200) } : {}),
        }
      : {}),
  };
}

function sanitizeConnections(raw: unknown): DataFlowConnectionRef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DataFlowConnectionRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const sourceId = String((item as DataFlowConnectionRef).sourceId || '');
    const targetId = String((item as DataFlowConnectionRef).targetId || '');
    if (!sourceId || !targetId || sourceId === targetId) continue;
    const key = `${sourceId}->${targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sourceId, targetId });
  }
  return out;
}

function sanitizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sanitizeEndpointIds(raw: unknown): string[] {
  return sanitizeIdList(raw);
}

/** Cap: a stamp is a record, not a place to keep the model. */
const MAX_DEPENDENCIES = 400;

function sanitizeValidation(raw: unknown): FlowValidationStamp | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rec = raw as FlowValidationStamp;
  const checkedAt = String(rec.checkedAt || '').slice(0, 40);
  if (!checkedAt) return undefined;
  const dependencies = Array.isArray(rec.dependencies)
    ? rec.dependencies
        .filter((dep): dep is FlowDependency => Boolean(dep && typeof dep === 'object' && dep.key))
        .slice(0, MAX_DEPENDENCIES)
        .map((dep) => ({
          key: String(dep.key).slice(0, 200),
          kind: dep.kind,
          name: String(dep.name || '').slice(0, 200),
          /* Contracts can be long; the stamp only needs to notice a change,
             and a hash would cost us the ability to show what it was. */
          fingerprint: String(dep.fingerprint || '').slice(0, 2000),
        }))
    : [];
  return {
    checkedAt,
    ...(rec.checkedBy ? { checkedBy: rec.checkedBy } : {}),
    dependencies,
  };
}

export function sanitizeDataFlowStep(raw: unknown, index = 0): DataFlowStep {
  const rec = raw && typeof raw === 'object' ? (raw as DataFlowStep) : ({} as DataFlowStep);
  const id = String(rec.id || '') || `step_${index}`;
  const parallelGroupId = sanitizeParallelGroupId(rec.parallelGroupId);
  const branchKind = sanitizeBranchKind(rec.branchKind);
  const branchArmId = parallelGroupId ? sanitizeParallelGroupId(rec.branchArmId) : undefined;
  const kind = rec.kind === 'link' ? 'link' : 'hop';
  const nextFlowRef = kind === 'link' ? sanitizeFlowContinuation(rec.nextFlowRef) : undefined;
  return {
    id,
    name: String(rec.name || '').slice(0, 200),
    description: rec.description ? String(rec.description).slice(0, 2000) : '',
    from: sanitizeParticipant(rec.from),
    to: sanitizeParticipant(rec.to),
    endpointIds: sanitizeEndpointIds(rec.endpointIds),
    channelIds: sanitizeEndpointIds(rec.channelIds),
    connections: sanitizeConnections(rec.connections),
    ...(parallelGroupId ? { parallelGroupId, branchKind } : {}),
    ...(branchArmId ? { branchArmId } : {}),
    ...(kind === 'link' ? { kind, nextFlowRef } : {}),
  };
}

function sanitizeFlowContinuation(raw: unknown): FlowContinuationRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rec = raw as FlowContinuationRef;
  const id = String(rec.id || '').trim();
  const projectId = String(rec.projectId || '').trim();
  if (!id || !projectId) return undefined;
  return {
    id,
    projectId,
    name: String(rec.name || '').slice(0, 200),
    projectName: String(rec.projectName || '').slice(0, 200),
  };
}

export function sanitizeDataFlow(raw: unknown, index = 0): StoredDataFlow | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as StoredDataFlow & { nextFlowRef?: unknown };
  const id = String(rec.id || '') || `flow_${index}`;
  const steps = Array.isArray(rec.steps)
    ? rec.steps.map((step, i) => sanitizeDataFlowStep(step, i))
    : [];
  const now = new Date().toISOString();
  /* Migration: a flow saved before "continues into" became a step still
     carries the pointer at the flow level. Fold it into a trailing link
     step so it keeps working exactly as before, and stop writing the
     flow-level field once this flow is next saved. */
  const legacyNextFlowRef = sanitizeFlowContinuation(rec.nextFlowRef);
  const hasLinkStep = steps.some((s) => s.kind === 'link');
  if (legacyNextFlowRef && !hasLinkStep) {
    /* Deterministic, not newDataFlowStepId()'s random one: this step is
       synthesized fresh on every sanitize pass until the flow is actually
       saved, and two independent passes over the same unsaved raw flow
       (e.g. the "saved" and "draft" copies in the editor) must agree on
       its id, or the draft reads as dirty the instant it's opened. */
    steps.push({
      id: `link_${id}`,
      name: '',
      from: { id: '', type: 'container' },
      to: { id: '', type: 'container' },
      kind: 'link',
      nextFlowRef: legacyNextFlowRef,
    });
  }
  return {
    id,
    name: String(rec.name || '').slice(0, 200),
    description: rec.description ? String(rec.description).slice(0, 4000) : '',
    steps,
    documentationIds: sanitizeIdList(rec.documentationIds),
    sequenceIds: sanitizeIdList(rec.sequenceIds),
    magicSequenceId: String(rec.magicSequenceId || '').trim() || undefined,
    magicSequenceSourceKey: String(rec.magicSequenceSourceKey || '').trim() || undefined,
    validation: sanitizeValidation(rec.validation),
    modelVersion: 1,
    createdAt: rec.createdAt || now,
    updatedAt: rec.updatedAt || rec.createdAt || now,
    createdBy: rec.createdBy,
    updatedBy: rec.updatedBy,
  };
}

/** Structural sanitize for writes. Do not trim names — Yjs would echo that back into live inputs. */
export function persistDataFlow(flow: StoredDataFlow): StoredDataFlow {
  const sanitized = sanitizeDataFlow(flow);
  if (!sanitized) {
    return {
      ...flow,
      name: String(flow.name || '').slice(0, 200) || 'Magic flow',
    };
  }
  return {
    ...sanitized,
    name: sanitized.name || 'Magic flow',
  };
}

/** Content fingerprint for unsaved-draft checks. Ignores audit timestamps. */
export function flowDraftKey(flow: StoredDataFlow): string {
  const p = persistDataFlow(flow);
  return JSON.stringify({
    name: p.name,
    description: p.description || '',
    steps: p.steps,
    documentationIds: p.documentationIds || [],
    sequenceIds: p.sequenceIds || [],
    magicSequenceId: p.magicSequenceId || '',
    magicSequenceSourceKey: p.magicSequenceSourceKey || '',
    /* A confirmation is a change to the flow: it has to be saved like one. */
    validation: p.validation || null,
  });
}

export function isDataFlowDraftDirty(
  draft: StoredDataFlow | null,
  saved: StoredDataFlow | null | undefined
): boolean {
  if (!draft) return false;
  if (!saved) return true;
  return flowDraftKey(draft) !== flowDraftKey(saved);
}

/*
 * Sanitising every flow is not free, and this is called per node card on the
 * canvas — once per card, per render. Keyed on the model object, so a new
 * model (any edit) gets a fresh list and nothing has to invalidate anything.
 * The array is shared: callers read it, none of them write to it.
 */
const modelFlowsCache = new WeakMap<FlatC4Model, StoredDataFlow[]>();

export function getModelDataFlows(model: FlatC4Model | null | undefined): StoredDataFlow[] {
  if (!model) return [];
  const cached = modelFlowsCache.get(model);
  if (cached) return cached;
  const raw = asFlowsModel(model).dataFlows;
  const flows = Array.isArray(raw)
    ? raw
        .map((item, i) => sanitizeDataFlow(item, i))
        .filter((item): item is StoredDataFlow => Boolean(item))
    : [];
  modelFlowsCache.set(model, flows);
  return flows;
}

export function emptyDataFlowStep(kind: 'hop' | 'link' = 'hop'): DataFlowStep {
  return {
    id: newDataFlowStepId(),
    name: '',
    description: '',
    from: { id: '', type: 'container' },
    to: { id: '', type: 'container' },
    endpointIds: [],
    channelIds: [],
    connections: [],
    ...(kind === 'link' ? { kind } : {}),
  };
}

export function emptyDataFlow(name = 'New Magic flow'): StoredDataFlow {
  const now = new Date().toISOString();
  return {
    id: newDataFlowId(),
    name,
    description: '',
    steps: [emptyDataFlowStep()],
    documentationIds: [],
    sequenceIds: [],
    modelVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function swapStepDirection(step: DataFlowStep): DataFlowStep {
  return {
    ...step,
    from: { ...step.to },
    to: { ...step.from },
    connections: (step.connections || []).map((c) => ({
      sourceId: c.targetId,
      targetId: c.sourceId,
    })),
  };
}

/** One track of a fork — a sequence of steps, not a single hop. */
export type DataFlowBranchArm = {
  id: string;
  steps: DataFlowStep[];
};

export type DataFlowStage = {
  id: string;
  /** More than one arm runs here — as `kind` says, together or instead. */
  branched: boolean;
  kind: FlowBranchKind;
  /** Every step of the stage, in stored order. */
  steps: DataFlowStep[];
  /** Those same steps, split into the tracks they run on. */
  arms: DataFlowBranchArm[];
};

function withoutParallelGroup(step: DataFlowStep): DataFlowStep {
  const next = { ...step };
  delete next.parallelGroupId;
  delete next.branchKind;
  delete next.branchArmId;
  return next;
}

/** A step that belongs to no fork stands alone. */
function plainStage(step: DataFlowStep): DataFlowStage {
  return {
    id: step.id,
    branched: false,
    kind: 'parallel',
    steps: [step],
    arms: [{ id: step.id, steps: [step] }],
  };
}

/** Consecutive steps sharing `branchArmId` are one arm; a bare step is its own. */
function splitIntoArms(steps: DataFlowStep[]): DataFlowBranchArm[] {
  const arms: DataFlowBranchArm[] = [];
  for (const step of steps) {
    const armId = step.branchArmId || '';
    const last = arms[arms.length - 1];
    if (armId && last && last.id === armId) {
      last.steps.push(step);
      continue;
    }
    arms.push({ id: armId || step.id, steps: [step] });
  }
  return arms;
}

export function flattenFlowStages(stages: DataFlowStage[]): DataFlowStep[] {
  return stages.flatMap((stage) => stage.steps);
}

/**
 * Consecutive steps sharing `parallelGroupId` form one fork; inside it,
 * `branchArmId` says which track each step runs on.
 *
 * The stage's kind comes from its first step — the writers keep every step of a
 * group in agreement, and a disagreeing tail is not worth honouring.
 */
export function groupFlowStages(steps: DataFlowStep[]): DataFlowStage[] {
  const runs: { gid: string; kind: FlowBranchKind; steps: DataFlowStep[] }[] = [];
  for (const step of steps) {
    const gid = step.parallelGroupId || '';
    const last = runs[runs.length - 1];
    if (gid && last && last.gid === gid) {
      last.steps.push(step);
      continue;
    }
    runs.push({
      gid,
      kind: step.branchKind === 'alternative' ? 'alternative' : 'parallel',
      steps: [step],
    });
  }

  const out: DataFlowStage[] = [];
  for (const run of runs) {
    const arms = run.gid ? splitIntoArms(run.steps) : [];
    /* One track is not a fork, whatever the group id says — the steps simply
       follow one another, the same as a stray group of one always has. */
    if (arms.length < 2) {
      for (const step of run.steps) out.push(plainStage(step));
      continue;
    }
    out.push({ id: run.gid, branched: true, kind: run.kind, steps: run.steps, arms });
  }
  return out;
}

/** The track `stepId` runs on, or null when it is not inside a fork. */
export function armOfStep(stage: DataFlowStage, stepId: string): DataFlowBranchArm | null {
  if (!stage.branched) return null;
  return stage.arms.find((arm) => arm.steps.some((s) => s.id === stepId)) ?? null;
}

export function stageAtStepIndex(
  steps: DataFlowStep[],
  stepIndex: number
): { stage: DataFlowStage; stageIndex: number } | null {
  const step = steps[stepIndex];
  if (!step) return null;
  const stages = groupFlowStages(steps);
  const stageIndex = stages.findIndex((s) => s.steps.some((x) => x.id === step.id));
  if (stageIndex < 0) return null;
  return { stage: stages[stageIndex]!, stageIndex };
}

export function firstIndexOfStage(steps: DataFlowStep[], stage: DataFlowStage): number {
  const first = stage.steps[0];
  if (!first) return 0;
  return Math.max(0, steps.findIndex((s) => s.id === first.id));
}

/**
 * Which hops the canvas should light for the current playback stage.
 * OR waits for a branch pick; parallel (and an unpicked OR preview) shows every arm.
 */
export function playbackHighlightSteps(
  stage: DataFlowStage,
  branchStepId?: string | null
): DataFlowStep[] {
  if (stage.kind === 'alternative' && stage.branched && branchStepId) {
    const picked = stage.steps.find((s) => s.id === branchStepId);
    if (picked) return [picked];
  }
  return stage.steps;
}

export function indexOfStepInFlow(steps: DataFlowStep[], stepId: string): number {
  return Math.max(0, steps.findIndex((s) => s.id === stepId));
}

/**
 * The next or previous step along the track being played, null at its end.
 *
 * Once a branch has been picked, playback walks that branch rather than
 * treating the whole fork as one beat — the beats of the other tracks are not
 * on the path the reader chose.
 */
export function stepAlongArm(
  steps: DataFlowStep[],
  stepId: string,
  dir: -1 | 1
): DataFlowStep | null {
  const stages = groupFlowStages(steps);
  const stage = stages.find((s) => s.steps.some((x) => x.id === stepId));
  const arm = stage ? armOfStep(stage, stepId) : null;
  if (!stage || !arm) return null;
  const at = arm.steps.findIndex((s) => s.id === stepId);
  return arm.steps[at + dir] ?? null;
}

/** When play starts on a concrete hop inside an OR stage, that hop is the pick. */
export function initialOrBranchStepId(
  steps: DataFlowStep[],
  stepIndex: number,
  explicitStepId?: string | null
): string | null {
  if (!explicitStepId) return null;
  const hit = stageAtStepIndex(steps, stepIndex);
  if (!hit || hit.stage.kind !== 'alternative' || !hit.stage.branched) return null;
  return hit.stage.steps.some((s) => s.id === explicitStepId) ? explicitStepId : null;
}

export function adjacentStageFirstIndex(
  steps: DataFlowStep[],
  stepIndex: number,
  dir: -1 | 1
): number {
  const hit = stageAtStepIndex(steps, stepIndex);
  if (!hit) return stepIndex;
  const stages = groupFlowStages(steps);
  const next = stages[hit.stageIndex + dir];
  if (!next) return stepIndex;
  return firstIndexOfStage(steps, next);
}

export function isLinkOnlyStage(stage: DataFlowStage): boolean {
  return stage.steps.length > 0 && stage.steps.every((s) => s.kind === 'link');
}

/** Playback skips exclusive link stages — they are a jump, not a stop. */
export function playbackFlowStages(steps: DataFlowStep[]): DataFlowStage[] {
  return groupFlowStages(steps).filter((s) => !isLinkOnlyStage(s));
}

/** If the next stage is a link, Next should jump there instead of stopping on it. */
export function outgoingLinkAfterStep(
  steps: DataFlowStep[],
  stepIndex: number
): FlowContinuationRef | undefined {
  const hit = stageAtStepIndex(steps, stepIndex);
  if (!hit) return undefined;
  const next = groupFlowStages(steps)[hit.stageIndex + 1];
  if (!next || !isLinkOnlyStage(next)) return undefined;
  return next.steps.find((s) => s.kind === 'link')?.nextFlowRef;
}

/**
 * First playable hop after the outgoing link that follows `stepIndex`.
 * Null when the link is missing or is the last stage of this flow.
 */
export function resumeIndexAfterOutgoingLink(
  steps: DataFlowStep[],
  stepIndex: number
): number | null {
  const hit = stageAtStepIndex(steps, stepIndex);
  if (!hit) return null;
  const stages = groupFlowStages(steps);
  let i = hit.stageIndex + 1;
  if (!stages[i] || !isLinkOnlyStage(stages[i]!)) return null;
  i += 1;
  while (stages[i] && isLinkOnlyStage(stages[i]!)) i += 1;
  const after = stages[i];
  if (!after) return null;
  return firstIndexOfStage(steps, after);
}

/**
 * First playable hop after a link stage that `stepIndex` is currently on
 * (or after consecutive link-only stages starting there).
 */
export function resumeIndexAfterLinkAt(
  steps: DataFlowStep[],
  stepIndex: number
): number | null {
  const hit = stageAtStepIndex(steps, stepIndex);
  if (!hit || !isLinkOnlyStage(hit.stage)) return null;
  const stages = groupFlowStages(steps);
  let i = hit.stageIndex + 1;
  while (stages[i] && isLinkOnlyStage(stages[i]!)) i += 1;
  const after = stages[i];
  if (!after) return null;
  return firstIndexOfStage(steps, after);
}

export function adjacentPlaybackStageFirstIndex(
  steps: DataFlowStep[],
  stepIndex: number,
  dir: -1 | 1
): number {
  const hit = stageAtStepIndex(steps, stepIndex);
  if (!hit) return stepIndex;
  const stages = groupFlowStages(steps);
  let i = hit.stageIndex + dir;
  while (stages[i] && isLinkOnlyStage(stages[i]!)) i += dir;
  const next = stages[i];
  if (!next) return stepIndex;
  return firstIndexOfStage(steps, next);
}

const BRANCH_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * `3`, `3a`, or `3a.2` — stage, track, and position along the track.
 *
 * The position is only spelled out when some track of that fork actually runs
 * more than one step, so a fork of single hops still reads `3a` / `3b` the way
 * it always has, and every label within one fork is shaped the same.
 */
export function flowStepNumberLabel(steps: DataFlowStep[], stepId: string): string {
  const stages = groupFlowStages(steps);
  let stageNum = 0;
  for (const stage of stages) {
    stageNum += 1;
    if (!stage.steps.some((s) => s.id === stepId)) continue;
    if (!stage.branched) return String(stageNum);

    const armIndex = stage.arms.findIndex((arm) => arm.steps.some((s) => s.id === stepId));
    if (armIndex < 0) return String(stageNum);
    const arm = stage.arms[armIndex]!;
    const track =
      armIndex < BRANCH_LETTERS.length
        ? `${stageNum}${BRANCH_LETTERS[armIndex]}`
        : `${stageNum}.${armIndex + 1}`;

    if (!stage.arms.some((a) => a.steps.length > 1)) return track;
    return `${track}.${arm.steps.findIndex((s) => s.id === stepId) + 1}`;
  }
  return '';
}

/** Swap the stage's contiguous run of steps for `next`. */
function replaceStageSteps(
  steps: DataFlowStep[],
  stage: DataFlowStage,
  next: DataFlowStep[]
): DataFlowStep[] {
  const first = stage.steps[0];
  if (!first) return steps;
  const at = steps.findIndex((s) => s.id === first.id);
  if (at < 0) return steps;
  return [...steps.slice(0, at), ...next, ...steps.slice(at + stage.steps.length)];
}

/**
 * Open a new track beside the one `stepId` runs on.
 * @param kind what the tracks mean together. On a stage that already has
 * branches this also re-stamps the existing ones, so a stage is never half AND
 * and half OR.
 */
export function addBranch(
  steps: DataFlowStep[],
  stepId: string,
  kind: FlowBranchKind = 'parallel'
): { steps: DataFlowStep[]; newStep: DataFlowStep | null } {
  const stages = groupFlowStages(steps);
  const stage = stages.find((s) => s.steps.some((x) => x.id === stepId));
  if (!stage) return { steps, newStep: null };
  const groupId = stage.branched
    ? stage.id
    : stage.steps[0]?.parallelGroupId || newParallelGroupId();

  /*
   * Every track gets a real id here, the one that was the whole stage a moment
   * ago included. Without one there is nothing for a second step to join, and
   * adding a step to that track would have to open yet another fork instead.
   */
  const existing = stage.arms.flatMap((arm) => {
    const armId = arm.steps[0]?.branchArmId || newBranchArmId();
    return arm.steps.map((st) => ({
      ...st,
      parallelGroupId: groupId,
      branchKind: kind,
      branchArmId: armId,
    }));
  });

  const newStep: DataFlowStep = {
    ...emptyDataFlowStep(),
    parallelGroupId: groupId,
    branchKind: kind,
    branchArmId: newBranchArmId(),
  };
  return { steps: replaceStageSteps(steps, stage, [...existing, newStep]), newStep };
}

/**
 * Add one more step to the track `stepId` runs on, after that track's last one.
 *
 * This is the move that was missing: without it the only way to say anything
 * more about a branch was to open another branch beside it, which is how
 * sequential steps ended up recorded as alternatives to each other.
 */
export function addStepToArm(
  steps: DataFlowStep[],
  stepId: string
): { steps: DataFlowStep[]; newStep: DataFlowStep | null } {
  const stages = groupFlowStages(steps);
  const stage = stages.find((s) => s.steps.some((x) => x.id === stepId));
  const arm = stage ? armOfStep(stage, stepId) : null;
  if (!stage || !arm) return { steps, newStep: null };

  const armId = arm.steps[0]?.branchArmId || newBranchArmId();
  const newStep: DataFlowStep = {
    ...emptyDataFlowStep(),
    parallelGroupId: stage.id,
    branchKind: stage.kind,
    branchArmId: armId,
  };
  const inArm = new Set(arm.steps.map((s) => s.id));
  const lastInArm = arm.steps[arm.steps.length - 1]!.id;
  const next: DataFlowStep[] = [];
  for (const step of stage.steps) {
    next.push(inArm.has(step.id) ? { ...step, branchArmId: armId } : step);
    if (step.id === lastInArm) next.push(newStep);
  }
  return { steps: replaceStageSteps(steps, stage, next), newStep };
}

/** Flip a branched stage between "all of these" and "one of these". */
export function setBranchKind(
  steps: DataFlowStep[],
  stepId: string,
  kind: FlowBranchKind
): DataFlowStep[] {
  const stages = groupFlowStages(steps);
  const stage = stages.find((s) => s.steps.some((x) => x.id === stepId));
  if (!stage?.branched) return steps;
  const ids = new Set(stage.steps.map((s) => s.id));
  return steps.map((step) => (ids.has(step.id) ? { ...step, branchKind: kind } : step));
}

/**
 * Take the whole track `stepId` runs on out of the fork.
 *
 * Its steps come out in order and follow the fork as ordinary steps — a track
 * is a sequence, so pulling one step out of the middle of it would leave the
 * rest saying something the author never wrote. A fork down to its last track
 * is no longer a fork, so that one dissolves too.
 */
export function detachFromBranch(steps: DataFlowStep[], stepId: string): DataFlowStep[] {
  const stages = groupFlowStages(steps);
  const stage = stages.find((s) => s.steps.some((x) => x.id === stepId));
  const arm = stage ? armOfStep(stage, stepId) : null;
  if (!stage || !arm) return steps;

  const rest = stage.arms.filter((a) => a.id !== arm.id);
  const keptSteps = rest.flatMap((a) => a.steps);
  const kept = rest.length > 1 ? keptSteps : keptSteps.map(withoutParallelGroup);
  const pulled = arm.steps.map(withoutParallelGroup);
  return replaceStageSteps(steps, stage, [...kept, ...pulled]);
}

export function moveFlowStage(steps: DataFlowStep[], stepId: string, dir: -1 | 1): DataFlowStep[] {
  const stages = groupFlowStages(steps);
  const idx = stages.findIndex((s) => s.steps.some((x) => x.id === stepId));
  const nextIdx = idx + dir;
  if (idx < 0 || nextIdx < 0 || nextIdx >= stages.length) return steps;
  const next = [...stages];
  const [item] = next.splice(idx, 1);
  next.splice(nextIdx, 0, item!);
  return flattenFlowStages(next);
}

export function removeFlowStep(steps: DataFlowStep[], stepId: string): DataFlowStep[] {
  if (steps.length <= 1) return steps;
  const next = steps.filter((s) => s.id !== stepId);
  return flattenFlowStages(
    groupFlowStages(next).map((stage) =>
      stage.branched
        ? stage
        : { ...stage, steps: stage.steps.map(withoutParallelGroup) }
    )
  );
}

/** Any element on any level, by id — the four lists are the only places to look. */
export function findById(model: FlatC4Model, id: string): { type: FlowOwnerType; item: BlockLike } | null {
  const system = model.systems.find((s) => s.id === id);
  if (system) return { type: 'system', item: system as BlockLike };
  const container = model.containers.find((c) => c.id === id);
  if (container) return { type: 'container', item: container as BlockLike };
  const component = model.components.find((c) => c.id === id);
  if (component) return { type: 'component', item: component as BlockLike };
  const code = model.codeElements.find((c) => c.id === id);
  if (code) return { type: 'code', item: code as BlockLike };
  return null;
}

function originalIdOf(item: { original?: unknown } | null | undefined): string | undefined {
  const raw = item?.original;
  if (!raw || typeof raw !== 'object') return undefined;
  const id = (raw as { id?: unknown }).id;
  return typeof id === 'string' && id ? id : undefined;
}

function allLocatedBlocks(model: FlatC4Model): Array<{ type: FlowOwnerType; item: BlockLike }> {
  return [
    ...(model.systems as unknown as BlockLike[]).map((item) => ({ type: 'system' as const, item })),
    ...(model.containers as unknown as BlockLike[]).map((item) => ({
      type: 'container' as const,
      item,
    })),
    ...(model.components as unknown as BlockLike[]).map((item) => ({
      type: 'component' as const,
      item,
    })),
    ...(model.codeElements as unknown as BlockLike[]).map((item) => ({
      type: 'code' as const,
      item,
    })),
  ];
}

/** Original + every clone of that original (including remote originals). */
function aliasIds(
  model: FlatC4Model,
  ref: FlowParticipantRef | { id: string; projectId?: string } | null | undefined
): Set<string> {
  const ids = new Set<string>();
  if (!ref?.id) return ids;
  ids.add(ref.id);
  const found = findById(model, ref.id);
  const root = originalIdOf(found?.item) || ref.id;
  ids.add(root);
  const refProject = (ref as FlowParticipantRef).projectId;
  for (const { item } of allLocatedBlocks(model)) {
    if (item.id === root || originalIdOf(item) === root) ids.add(item.id);
    const orig = item.original as { id?: string; projectId?: string } | undefined;
    if (orig?.id === ref.id) {
      if (!refProject || !orig.projectId || orig.projectId === refProject) {
        ids.add(item.id);
      }
    }
  }
  return ids;
}

/**
 * Which project a playback stage should be shown on.
 * Prefers an explicit participant.projectId, else a remote clone's original.
 */
export function preferredProjectForStage(
  model: FlatC4Model,
  steps: DataFlowStep[],
  homeProjectId: string | undefined,
  currentProjectId: string | undefined
): string | undefined {
  const votes = new Map<string, number>();
  const bump = (pid: string | undefined) => {
    if (!pid) return;
    votes.set(pid, (votes.get(pid) || 0) + 1);
  };

  for (const step of steps) {
    bump(step.from.projectId || homeProjectId);
    bump(step.to.projectId || homeProjectId);
    for (const ref of [step.from, step.to]) {
      for (const { item } of allLocatedBlocks(model)) {
        const orig = item.original as { id?: string; projectId?: string } | undefined;
        if (orig?.id === ref.id && orig.projectId) bump(orig.projectId);
      }
      if (findById(model, ref.id) && !ref.projectId) bump(currentProjectId || homeProjectId);
    }
  }

  if (!votes.size) return currentProjectId || homeProjectId;
  let best: string | undefined;
  let bestScore = -1;
  for (const [pid, score] of votes) {
    if (score > bestScore) {
      best = pid;
      bestScore = score;
    }
  }
  if (
    currentProjectId &&
    votes.get(currentProjectId) === bestScore
  ) {
    return currentProjectId;
  }
  return best;
}

const VIEW_DEPTH: Record<ViewLevel, number> = {
  code: 0,
  component: 1,
  container: 2,
  system: 3,
};

function viewForLocatedConnection(
  model: FlatC4Model,
  level: FlowOwnerType,
  sourceId: string,
  targetId: string
): DiagramFocusTarget {
  const src = findById(model, sourceId);
  const tgt = findById(model, targetId);
  if (level === 'system') {
    return { id: sourceId, viewLevel: 'system' };
  }
  if (level === 'container') {
    const systemId = src?.item.systemId || tgt?.item.systemId;
    return { id: sourceId, viewLevel: 'container', activeSystemId: systemId };
  }
  if (level === 'component') {
    const containerId = src?.item.containerId || tgt?.item.containerId;
    const systemId =
      src?.item.systemId ||
      tgt?.item.systemId ||
      model.containers.find((c) => c.id === containerId)?.systemId;
    return {
      id: sourceId,
      viewLevel: 'component',
      activeSystemId: systemId,
      activeContainerId: containerId,
    };
  }
  const componentId = src?.item.componentId || tgt?.item.componentId;
  const parent = model.components.find((c) => c.id === componentId);
  return {
    id: sourceId,
    viewLevel: 'code',
    activeSystemId: parent?.systemId,
    activeContainerId: parent?.containerId,
    activeComponentId: componentId,
  };
}

type StepEdgeHit = {
  sourceId: string;
  targetId: string;
  motion: 'forward' | 'reverse';
  view: DiagramFocusTarget;
};

/** Real C4 edges that realize this hop, including clone cards. */
function discoverStepEdges(model: FlatC4Model, step: DataFlowStep): StepEdgeHit[] {
  const fromIds = aliasIds(model, step.from);
  const toIds = aliasIds(model, step.to);
  const explicitPairs = (step.connections || []).map((conn) => ({
    src: aliasIds(model, { id: conn.sourceId }),
    tgt: aliasIds(model, { id: conn.targetId }),
  }));
  const hits: StepEdgeHit[] = [];

  for (const { type, item } of allLocatedBlocks(model)) {
    for (const conn of item.connections || []) {
      const a = item.id;
      const b = conn.targetId;
      if (explicitPairs.length) {
        const listed = explicitPairs.some(
          (pair) =>
            (pair.src.has(a) && pair.tgt.has(b)) || (pair.src.has(b) && pair.tgt.has(a))
        );
        if (!listed) continue;
      }
      const forward = fromIds.has(a) && toIds.has(b);
      const reverse = fromIds.has(b) && toIds.has(a);
      if (!forward && !reverse && !explicitPairs.length) continue;
      if (!forward && !reverse && explicitPairs.length) {
        hits.push({
          sourceId: a,
          targetId: b,
          motion: 'forward',
          view: viewForLocatedConnection(model, type, a, b),
        });
        continue;
      }
      if (!forward && !reverse) continue;
      hits.push({
        sourceId: a,
        targetId: b,
        motion: forward ? 'forward' : 'reverse',
        view: viewForLocatedConnection(model, type, a, b),
      });
    }
  }
  return hits;
}

function viewOfBlock(
  model: FlatC4Model,
  type: FlowOwnerType,
  item: BlockLike
): DiagramFocusTarget {
  if (type === 'system') return { id: item.id, viewLevel: 'system' };
  if (type === 'container') {
    return { id: item.id, viewLevel: 'container', activeSystemId: item.systemId };
  }
  if (type === 'component') {
    return {
      id: item.id,
      viewLevel: 'component',
      activeSystemId: item.systemId,
      activeContainerId: item.containerId,
    };
  }
  const parent = model.components.find((c) => c.id === item.componentId);
  return {
    id: item.id,
    viewLevel: 'code',
    activeSystemId: parent?.systemId,
    activeContainerId: parent?.containerId,
    activeComponentId: item.componentId,
  };
}

function blocksOnView(model: FlatC4Model, view: DiagramFocusTarget): BlockLike[] {
  if (view.viewLevel === 'system') return model.systems as unknown as BlockLike[];
  if (view.viewLevel === 'container') {
    const all = model.containers as unknown as BlockLike[];
    if (!view.activeSystemId) return all;
    return all.filter((item) => item.systemId === view.activeSystemId);
  }
  if (view.viewLevel === 'component') {
    const all = model.components as unknown as BlockLike[];
    if (!view.activeContainerId) return all;
    return all.filter((item) => item.containerId === view.activeContainerId);
  }
  const all = model.codeElements as unknown as BlockLike[];
  if (!view.activeComponentId) return all;
  return all.filter((item) => item.componentId === view.activeComponentId);
}

type PathLink = {
  sourceId: string;
  targetId: string;
  motion: 'forward' | 'reverse';
};

type PathHit = {
  nodeIds: Set<string>;
  links: PathLink[];
};

function uniqueViews(views: DiagramFocusTarget[]): DiagramFocusTarget[] {
  const out: DiagramFocusTarget[] = [];
  for (const view of views) {
    if (out.some((item) => sameDiagramView(item, view))) continue;
    out.push(view);
  }
  return out;
}

function shortestPathHit(
  starts: Set<string>,
  ends: Set<string>,
  outgoing: Map<string, PathLink[]>
): PathHit | null {
  if (!starts.size || !ends.size) return null;
  const dist = new Map<string, number>();
  const parents = new Map<string, Array<{ node: string; link: PathLink }>>();
  const queue: string[] = [];
  for (const id of starts) {
    dist.set(id, 0);
    queue.push(id);
  }
  let best = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]!;
    const d = dist.get(node) ?? Infinity;
    if (d > best) continue;
    if (ends.has(node)) best = Math.min(best, d);
    for (const link of outgoing.get(node) || []) {
      const next = link.motion === 'forward' ? link.targetId : link.sourceId;
      const hop = d + 1;
      const prev = dist.get(next);
      if (prev === undefined) {
        dist.set(next, hop);
        parents.set(next, [{ node, link }]);
        queue.push(next);
      } else if (hop === prev) {
        parents.get(next)?.push({ node, link });
      }
    }
  }
  if (best === Infinity) return null;

  const nodeIds = new Set<string>();
  const links: PathLink[] = [];
  const seenLinks = new Set<string>();
  const seenNodes = new Set<string>();
  const walk = (node: string) => {
    if (seenNodes.has(node)) return;
    seenNodes.add(node);
    nodeIds.add(node);
    if (starts.has(node) && (dist.get(node) || 0) === 0) return;
    for (const parent of parents.get(node) || []) {
      const key = `${parent.link.sourceId}->${parent.link.targetId}:${parent.link.motion}`;
      if (!seenLinks.has(key)) {
        seenLinks.add(key);
        links.push(parent.link);
      }
      walk(parent.node);
    }
  };
  for (const end of ends) {
    if (dist.get(end) === best) walk(end);
  }
  if (!links.length && ![...starts].some((id) => ends.has(id))) return null;
  return { nodeIds, links };
}

function adjacency(
  blocks: BlockLike[],
  undirected: boolean
): Map<string, PathLink[]> {
  const ids = new Set(blocks.map((b) => b.id));
  const out = new Map<string, PathLink[]>();
  const push = (from: string, link: PathLink) => {
    const list = out.get(from) || [];
    list.push(link);
    out.set(from, list);
  };
  for (const block of blocks) {
    if (!out.has(block.id)) out.set(block.id, []);
    for (const conn of block.connections || []) {
      if (!ids.has(conn.targetId)) continue;
      const forward: PathLink = {
        sourceId: block.id,
        targetId: conn.targetId,
        motion: 'forward',
      };
      push(block.id, forward);
      if (undirected) {
        push(conn.targetId, {
          sourceId: block.id,
          targetId: conn.targetId,
          motion: 'reverse',
        });
      }
    }
  }
  return out;
}

function pathOnView(
  model: FlatC4Model,
  view: DiagramFocusTarget,
  step: DataFlowStep
): PathHit | null {
  const blocks = blocksOnView(model, view);
  const canvas = new Set(blocks.map((b) => b.id));
  const asStarts = new Set(
    [...aliasIds(model, step.from)].filter((id) => canvas.has(id))
  );
  const asEnds = new Set([...aliasIds(model, step.to)].filter((id) => canvas.has(id)));
  const fromProj = projectAncestryToView(model, resolveAncestry(model, step.from), view);
  const toProj = projectAncestryToView(model, resolveAncestry(model, step.to), view);
  if (fromProj && canvas.has(fromProj)) asStarts.add(fromProj);
  if (toProj && canvas.has(toProj)) asEnds.add(toProj);
  if (!asStarts.size || !asEnds.size) return null;
  return (
    shortestPathHit(asStarts, asEnds, adjacency(blocks, false)) ||
    shortestPathHit(asStarts, asEnds, adjacency(blocks, true))
  );
}

function candidateViewsForStep(model: FlatC4Model, step: DataFlowStep): DiagramFocusTarget[] {
  const fromIds = aliasIds(model, step.from);
  const toIds = aliasIds(model, step.to);
  const views: DiagramFocusTarget[] = [];
  for (const located of allLocatedBlocks(model)) {
    if (!fromIds.has(located.item.id) && !toIds.has(located.item.id)) continue;
    views.push(viewOfBlock(model, located.type, located.item));
  }
  return uniqueViews(views);
}

function resolveAncestry(
  model: FlatC4Model,
  ref: FlowParticipantRef | { id: string; type?: FlowOwnerType } | null | undefined
): Ancestry | null {
  if (!ref?.id) return null;
  const found = ref.type
    ? (() => {
        if (ref.type === 'system') {
          const item = model.systems.find((s) => s.id === ref.id);
          return item ? { type: 'system' as const, item: item as BlockLike } : findById(model, ref.id);
        }
        if (ref.type === 'container') {
          const item = model.containers.find((c) => c.id === ref.id);
          return item ? { type: 'container' as const, item: item as BlockLike } : findById(model, ref.id);
        }
        if (ref.type === 'component') {
          const item = model.components.find((c) => c.id === ref.id);
          return item ? { type: 'component' as const, item: item as BlockLike } : findById(model, ref.id);
        }
        const item = model.codeElements.find((c) => c.id === ref.id);
        return item ? { type: 'code' as const, item: item as BlockLike } : findById(model, ref.id);
      })()
    : findById(model, ref.id);
  if (!found) return null;

  const { type, item } = found;
  if (type === 'system') {
    return { id: item.id, type, name: item.name || item.id, systemId: item.id };
  }
  if (type === 'container') {
    return {
      id: item.id,
      type,
      name: item.name || item.id,
      systemId: item.systemId,
      containerId: item.id,
    };
  }
  if (type === 'component') {
    return {
      id: item.id,
      type,
      name: item.name || item.id,
      systemId: item.systemId,
      containerId: item.containerId,
      componentId: item.id,
    };
  }
  const parent = model.components.find((c) => c.id === item.componentId);
  return {
    id: item.id,
    type,
    name: item.name || item.id,
    systemId: parent?.systemId,
    containerId: parent?.containerId,
    componentId: item.componentId,
  };
}

export function participantLabel(model: FlatC4Model, ref: FlowParticipantRef | null | undefined): string {
  const ancestry = resolveAncestry(model, ref || undefined);
  if (!ancestry) {
    /* Not in this model at all — a cross-domain participant on record from
       another project. The pick carried its own name for exactly this case. */
    if (ref?.name) return ref.projectName ? `${ref.name} · ${ref.projectName}` : ref.name;
    return ref?.id || '';
  }
  if (ancestry.type === 'system') return ancestry.name;
  if (ancestry.type === 'container') {
    const sys = model.systems.find((s) => s.id === ancestry.systemId);
    return sys ? `${ancestry.name} · ${sys.name}` : ancestry.name;
  }
  if (ancestry.type === 'component') {
    const container = model.containers.find((c) => c.id === ancestry.containerId);
    const found = findById(model, ancestry.id)?.item;
    const ep =
      found && isApiEndpoint(found)
        ? `${found.method || '*'} ${found.endpoint || ancestry.name}`
        : ancestry.name;
    return container ? `${ep} · ${container.name}` : ep;
  }
  const component = model.components.find((c) => c.id === ancestry.componentId);
  return component ? `${ancestry.name} · ${component.name}` : ancestry.name;
}

function descendantIds(model: FlatC4Model, ancestry: Ancestry | null): Set<string> {
  const ids = new Set<string>();
  if (!ancestry) return ids;
  ids.add(ancestry.id);
  if (ancestry.type === 'system') {
    for (const c of model.containers) {
      if (c.systemId === ancestry.id) ids.add(c.id);
    }
    for (const c of model.components) {
      if (c.systemId === ancestry.id) ids.add(c.id);
    }
    for (const c of model.codeElements) {
      const parent = model.components.find((p) => p.id === c.componentId);
      if (parent?.systemId === ancestry.id) ids.add(c.id);
    }
  } else if (ancestry.type === 'container') {
    for (const c of model.components) {
      if (c.containerId === ancestry.id) ids.add(c.id);
    }
    for (const c of model.codeElements) {
      const parent = model.components.find((p) => p.id === c.componentId);
      if (parent?.containerId === ancestry.id) ids.add(c.id);
    }
  } else if (ancestry.type === 'component') {
    for (const c of model.codeElements) {
      if (c.componentId === ancestry.id) ids.add(c.id);
    }
  }
  return ids;
}

type ContainmentIndex = {
  /** Every id an element sits under, itself included. */
  ancestorsOrSelf: Map<string, string[]>;
  /** Every id that sits under an element, itself included. */
  descendantsOrSelf: Map<string, string[]>;
};

/**
 * The containment tree as two lookups, built once per model.
 *
 * `descendantsOrSelf` is the inverse of `ancestorsOrSelf`, so the two agree by
 * construction — an element is under an ancestor exactly when the ancestor is
 * above the element. A component is claimed by both its container and its
 * system, which is why an ancestry is a list rather than a single parent.
 */
function buildContainment(model: FlatC4Model): ContainmentIndex {
  const componentParents = new Map<string, { systemId?: string; containerId?: string }>();
  for (const c of model.components) componentParents.set(c.id, c);
  const systemIds = new Set(model.systems.map((s) => s.id));
  const containerIds = new Set(model.containers.map((c) => c.id));

  /* A parent id that names nothing in this model is not an ancestor: it can
     never be asked about, and counting it would answer for an element that
     does not exist. Imports and cross-project clones leave such ids behind. */
  const ancestorsOrSelf = new Map<string, string[]>();
  const chainOf = (id: string, systemId?: string, containerId?: string, componentId?: string) => {
    const chain = [id];
    if (componentId && componentParents.has(componentId)) chain.push(componentId);
    if (containerId && containerIds.has(containerId)) chain.push(containerId);
    if (systemId && systemIds.has(systemId)) chain.push(systemId);
    return chain;
  };

  for (const s of model.systems) ancestorsOrSelf.set(s.id, [s.id]);
  for (const c of model.containers) {
    ancestorsOrSelf.set(c.id, chainOf(c.id, c.systemId));
  }
  for (const c of model.components) {
    ancestorsOrSelf.set(c.id, chainOf(c.id, c.systemId, c.containerId));
  }
  for (const c of model.codeElements) {
    const parent = c.componentId ? componentParents.get(c.componentId) : undefined;
    ancestorsOrSelf.set(
      c.id,
      chainOf(c.id, parent?.systemId, parent?.containerId, c.componentId)
    );
  }

  const descendantsOrSelf = new Map<string, string[]>();
  for (const [id, chain] of ancestorsOrSelf) {
    for (const ancestor of chain) {
      const list = descendantsOrSelf.get(ancestor);
      if (list) list.push(id);
      else descendantsOrSelf.set(ancestor, [id]);
    }
  }

  return { ancestorsOrSelf, descendantsOrSelf };
}

/**
 * Which elements a single step touches, and in what capacity.
 *
 * The claim order is the priority: an element that qualifies two ways keeps
 * the first, so a node named outright by the step is a 'from' rather than an
 * 'endpoint' it happens to contain. Ends first, then everything beneath them,
 * then everything they sit under.
 */
function stepSidesByElement(
  step: DataFlowStep,
  containment: ContainmentIndex
): Map<string, DataFlowParticipation['side']> {
  const sides = new Map<string, DataFlowParticipation['side']>();
  const claim = (id: string | undefined, side: DataFlowParticipation['side']) => {
    if (!id || sides.has(id)) return;
    sides.set(id, side);
  };
  const claimAll = (ids: string[] | undefined, side: DataFlowParticipation['side']) => {
    for (const id of ids || []) claim(id, side);
  };

  claim(step.from.id, 'from');
  claim(step.to.id, 'to');
  claimAll(step.endpointIds, 'endpoint');
  claimAll(step.channelIds, 'channel');
  for (const c of step.connections || []) {
    claim(c.sourceId, 'connection');
    claim(c.targetId, 'connection');
  }

  claimAll(containment.descendantsOrSelf.get(step.from.id), 'from');
  claimAll(containment.descendantsOrSelf.get(step.to.id), 'to');

  claimAll(containment.ancestorsOrSelf.get(step.from.id), 'from');
  claimAll(containment.ancestorsOrSelf.get(step.to.id), 'to');
  for (const id of step.endpointIds || []) {
    claimAll(containment.ancestorsOrSelf.get(id), 'endpoint');
  }
  for (const id of step.channelIds || []) {
    claimAll(containment.ancestorsOrSelf.get(id), 'channel');
  }
  for (const c of step.connections || []) {
    claimAll(containment.ancestorsOrSelf.get(c.sourceId), 'connection');
    claimAll(containment.ancestorsOrSelf.get(c.targetId), 'connection');
  }

  return sides;
}

/*
 * Asking each element which flows touch it walked every flow, every step and
 * the whole containment tree, once per element — and the canvas asks once per
 * card on every render. One pass the other way round answers for everything,
 * and the model object keys it, so an edit throws the index away by itself.
 */
const participationCache = new WeakMap<FlatC4Model, Map<string, DataFlowParticipation[]>>();

function getParticipationIndex(model: FlatC4Model): Map<string, DataFlowParticipation[]> {
  const cached = participationCache.get(model);
  if (cached) return cached;

  const containment = buildContainment(model);
  const index = new Map<string, DataFlowParticipation[]>();
  for (const flow of getModelDataFlows(model)) {
    flow.steps.forEach((step, stepIndex) => {
      for (const [elementId, side] of stepSidesByElement(step, containment)) {
        const hit: DataFlowParticipation = { flow, step, stepIndex, side };
        const list = index.get(elementId);
        if (list) list.push(hit);
        else index.set(elementId, [hit]);
      }
    });
  }

  participationCache.set(model, index);
  return index;
}

export function flowsForElement(model: FlatC4Model, elementId: string): DataFlowParticipation[] {
  if (!elementId) return [];
  return getParticipationIndex(model).get(elementId) ?? [];
}

export function uniqueFlowsForElement(model: FlatC4Model, elementId: string): StoredDataFlow[] {
  const seen = new Set<string>();
  const out: StoredDataFlow[] = [];
  for (const hit of flowsForElement(model, elementId)) {
    if (seen.has(hit.flow.id)) continue;
    seen.add(hit.flow.id);
    out.push(hit.flow);
  }
  return out;
}

export function listFlowParticipantOptions(model: FlatC4Model): FlowParticipantOption[] {
  return getFlowModelCache(model).participantOptions;
}

export function listStepChannelOptions(
  model: FlatC4Model,
  step: DataFlowStep
): FlowParticipantOption[] {
  const from = resolveAncestry(model, step.from);
  const to = resolveAncestry(model, step.to);
  const cache = getFlowModelCache(model);
  const allowed = new Set<string>([
    ...descendantIds(model, from),
    ...descendantIds(model, to),
  ]);
  return listFlowParticipantOptions(model).filter((opt) => {
    if (opt.type !== 'component') return false;
    const item = cache.componentsById.get(opt.id);
    if (!item || !isBrokerChannel(item as { kind?: string })) return false;
    return allowed.has(opt.id) || (item.containerId ? allowed.has(item.containerId) : false);
  });
}

export function listStepEndpointOptions(
  model: FlatC4Model,
  step: DataFlowStep
): FlowParticipantOption[] {
  const from = resolveAncestry(model, step.from);
  const to = resolveAncestry(model, step.to);
  const cache = getFlowModelCache(model);
  const allowed = new Set<string>([
    ...descendantIds(model, from),
    ...descendantIds(model, to),
  ]);
  return listFlowParticipantOptions(model).filter((opt) => {
    if (opt.type !== 'component') return false;
    const item = cache.componentsById.get(opt.id);
    if (!item || !isApiEndpoint(item as { kind?: string; endpoint?: string })) return false;
    return allowed.has(opt.id) || (item.containerId ? allowed.has(item.containerId) : false);
  });
}

export function listStepConnectionOptions(
  model: FlatC4Model,
  step: DataFlowStep
): FlowConnectionOption[] {
  const from = resolveAncestry(model, step.from);
  const to = resolveAncestry(model, step.to);
  const cache = getFlowModelCache(model);
  const allowed = new Set<string>([
    ...descendantIds(model, from),
    ...descendantIds(model, to),
    ...aliasIds(model, step.from),
    ...aliasIds(model, step.to),
  ]);
  const names = cache.participantNamesById;

  const out: FlowConnectionOption[] = [];
  const pushLevel = (level: FlowOwnerType, blocks: BlockLike[]) => {
    for (const block of blocks) {
      for (const conn of block.connections || []) {
        if (!allowed.has(block.id) && !allowed.has(conn.targetId)) continue;
        if (!allowed.has(block.id) || !allowed.has(conn.targetId)) continue;
        out.push({
          sourceId: block.id,
          targetId: conn.targetId,
          sourceName: names.get(block.id) || block.name || block.id,
          targetName: names.get(conn.targetId) || conn.targetId,
          label: conn.label,
          level,
        });
      }
    }
  };
  pushLevel('system', model.systems as unknown as BlockLike[]);
  pushLevel('container', model.containers as unknown as BlockLike[]);
  pushLevel('component', model.components as unknown as BlockLike[]);
  pushLevel('code', model.codeElements as unknown as BlockLike[]);
  out.sort((a, b) =>
    LABEL_COLLATOR.compare(
      `${a.label || ''} ${a.sourceName} ${a.targetName}`,
      `${b.label || ''} ${b.sourceName} ${b.targetName}`
    )
  );
  return out;
}

function projectAncestryToView(
  model: FlatC4Model,
  ancestry: Ancestry | null,
  view: { viewLevel: ViewLevel; activeSystemId?: string; activeContainerId?: string; activeComponentId?: string }
): string | null {
  if (!ancestry) return null;
  if (view.viewLevel === 'system') return ancestry.systemId || null;
  if (view.viewLevel === 'container') {
    if (ancestry.containerId) {
      if (view.activeSystemId && ancestry.systemId && ancestry.systemId !== view.activeSystemId) {
        return null;
      }
      return ancestry.containerId;
    }
    const clone = (model.containers as unknown as BlockLike[]).find(
      (item) =>
        (!view.activeSystemId || item.systemId === view.activeSystemId) &&
        (item.id === ancestry.id || originalIdOf(item) === ancestry.id)
    );
    return clone?.id ?? null;
  }
  if (view.viewLevel === 'component') {
    if (!ancestry.componentId) return null;
    if (view.activeContainerId && ancestry.containerId !== view.activeContainerId) return null;
    return ancestry.componentId;
  }
  if (ancestry.type !== 'code') return null;
  if (view.activeComponentId && ancestry.componentId !== view.activeComponentId) return null;
  return ancestry.id;
}

function projectIdToView(
  model: FlatC4Model,
  id: string,
  view: { viewLevel: ViewLevel; activeSystemId?: string; activeContainerId?: string; activeComponentId?: string }
): string | null {
  return projectAncestryToView(model, resolveAncestry(model, { id }), view);
}

function currentView(model: FlatC4Model): DiagramFocusTarget {
  return {
    id: '',
    viewLevel: model.viewLevel,
    activeSystemId: model.activeSystemId,
    activeContainerId: model.activeContainerId,
    activeComponentId: model.activeComponentId,
  };
}

function bothVisibleOnView(model: FlatC4Model, step: DataFlowStep, view: DiagramFocusTarget): boolean {
  const from = projectAncestryToView(model, resolveAncestry(model, step.from), view);
  const to = projectAncestryToView(model, resolveAncestry(model, step.to), view);
  return Boolean(from && to);
}

/**
 * C4 view of the actual connection for this hop (clone cards included).
 */
export function viewForStep(model: FlatC4Model, step: DataFlowStep): DiagramFocusTarget {
  const edgeHits = discoverStepEdges(model, step);
  const pathViews = candidateViewsForStep(model, step).filter((view) => {
    const path = pathOnView(model, view, step);
    return Boolean(path && path.links.length);
  });
  const connected = uniqueViews([
    ...edgeHits.map((hit) => hit.view),
    ...pathViews,
  ]);
  if (connected.length) {
    return [...connected].sort(
      (a, b) => VIEW_DEPTH[a.viewLevel] - VIEW_DEPTH[b.viewLevel]
    )[0]!;
  }

  const from = resolveAncestry(model, step.from);
  const to = resolveAncestry(model, step.to);
  const candidates: DiagramFocusTarget[] = [];

  if (from?.componentId && from.componentId === to?.componentId && from.systemId && from.containerId) {
    candidates.push({
      id: from.id,
      viewLevel: 'code',
      activeSystemId: from.systemId,
      activeContainerId: from.containerId,
      activeComponentId: from.componentId,
    });
  }
  if (from?.containerId && from.containerId === to?.containerId && from.systemId) {
    candidates.push({
      id: from.id,
      viewLevel: 'component',
      activeSystemId: from.systemId,
      activeContainerId: from.containerId,
    });
  }
  const sameSystem = from?.systemId && from.systemId === to?.systemId ? from.systemId : null;
  if (sameSystem) {
    candidates.push({
      id: from?.id || to?.id || sameSystem,
      viewLevel: 'container',
      activeSystemId: sameSystem,
    });
  }
  if (
    (from?.type === 'system' && to?.type === 'container' && to.systemId) ||
    (to?.type === 'system' && from?.type === 'container' && from.systemId)
  ) {
    const hostSystemId = from?.type === 'container' ? from.systemId : to?.systemId;
    if (hostSystemId) {
      candidates.unshift({
        id: from?.id || to?.id || hostSystemId,
        viewLevel: 'container',
        activeSystemId: hostSystemId,
      });
    }
  }
  candidates.push({
    id: from?.systemId || to?.systemId || step.from.id || step.to.id,
    viewLevel: 'system',
  });

  return candidates.find((view) => bothVisibleOnView(model, step, view)) || candidates[candidates.length - 1]!;
}

function sameDiagramView(a: DiagramFocusTarget, b: DiagramFocusTarget): boolean {
  return (
    a.viewLevel === b.viewLevel &&
    a.activeSystemId === b.activeSystemId &&
    a.activeContainerId === b.activeContainerId &&
    a.activeComponentId === b.activeComponentId
  );
}

/** Common C4 view for a playback stage; system if hops disagree. */
export function viewForStage(model: FlatC4Model, steps: DataFlowStep[]): DiagramFocusTarget {
  if (steps.length === 0) {
    return { id: '', viewLevel: 'system' };
  }
  if (steps.length === 1) return viewForStep(model, steps[0]!);
  const views = steps.map((step) => viewForStep(model, step));
  const first = views[0]!;
  if (views.every((view) => sameDiagramView(view, first))) return first;

  const systemIds = steps.map((step) => {
    const from = resolveAncestry(model, step.from);
    const to = resolveAncestry(model, step.to);
    return from?.systemId && from.systemId === to?.systemId ? from.systemId : null;
  });
  const systemId = systemIds[0];
  if (systemId && systemIds.every((id) => id === systemId)) {
    const candidate: DiagramFocusTarget = {
      id: systemId,
      viewLevel: 'container',
      activeSystemId: systemId,
    };
    if (steps.every((step) => bothVisibleOnView(model, step, candidate))) return candidate;
  }
  return { id: systemId || first.id, viewLevel: 'system' };
}

function blocksForView(model: FlatC4Model): BlockLike[] {
  switch (model.viewLevel) {
    case 'system':
      return model.systems as unknown as BlockLike[];
    case 'container':
      return model.containers as unknown as BlockLike[];
    case 'component':
      return model.components as unknown as BlockLike[];
    case 'code':
      return model.codeElements as unknown as BlockLike[];
    default:
      return [];
  }
}

export function highlightForStep(model: FlatC4Model, step: DataFlowStep): NeighborhoodHighlight {
  const view = currentView(model);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const flowMotion = new Map<string, 'forward' | 'reverse'>();

  const addEdge = (sourceId: string, targetId: string, motion: 'forward' | 'reverse') => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    nodeIds.add(sourceId);
    nodeIds.add(targetId);
    const key = `${sourceId}->${targetId}`;
    edgeIds.add(key);
    const prev = flowMotion.get(key);
    if (!prev || motion === 'forward') flowMotion.set(key, motion);
  };

  const edgesOnView = discoverStepEdges(model, step).filter((hit) =>
    sameDiagramView(hit.view, view)
  );
  for (const hit of edgesOnView) {
    addEdge(hit.sourceId, hit.targetId, hit.motion);
  }

  const path = pathOnView(model, view, step);
  if (path) {
    path.nodeIds.forEach((id) => nodeIds.add(id));
    for (const link of path.links) {
      addEdge(link.sourceId, link.targetId, link.motion);
    }
  }

  const fromId = projectAncestryToView(model, resolveAncestry(model, step.from), view);
  const toId = projectAncestryToView(model, resolveAncestry(model, step.to), view);
  if (fromId) nodeIds.add(fromId);
  if (toId) nodeIds.add(toId);

  for (const endpointId of step.endpointIds || []) {
    const projected = projectIdToView(model, endpointId, view);
    if (projected) nodeIds.add(projected);
  }
  for (const channelId of step.channelIds || []) {
    const projected = projectIdToView(model, channelId, view);
    if (projected) nodeIds.add(projected);
  }

  if (edgeIds.size === 0 && fromId && toId && fromId !== toId) {
    for (const block of blocksForView(model)) {
      for (const conn of block.connections || []) {
        const a = block.id;
        const b = conn.targetId;
        if (a === fromId && b === toId) addEdge(a, b, 'forward');
        else if (a === toId && b === fromId) addEdge(a, b, 'reverse');
      }
    }
  }

  return { nodeIds, edgeIds, flowMotion };
}

export function highlightForSteps(
  model: FlatC4Model,
  steps: DataFlowStep[]
): NeighborhoodHighlight {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const flowMotion = new Map<string, 'forward' | 'reverse'>();
  for (const step of steps) {
    const hit = highlightForStep(model, step);
    hit.nodeIds.forEach((id) => nodeIds.add(id));
    hit.edgeIds.forEach((id) => edgeIds.add(id));
    hit.flowMotion?.forEach((motion, key) => {
      const prev = flowMotion.get(key);
      if (!prev || motion === 'forward') flowMotion.set(key, motion);
    });
  }
  return { nodeIds, edgeIds, flowMotion };
}

export function dataFlowPlaybackPath(
  projectId: string | undefined,
  flowId: string,
  stepId?: string,
  returnTo?: string | null
): string {
  const params = new URLSearchParams();
  params.set('flow', flowId);
  if (stepId) params.set('step', stepId);
  if (returnTo) params.set('returnTo', returnTo);
  const q = params.toString();
  return projectId ? `/projects/${projectId}?${q}` : `/?${q}`;
}

export function dataFlowManagerPath(
  projectId: string | undefined,
  flowId?: string,
  stepId?: string,
  returnTo?: string | null
): string {
  const base = projectId ? `/projects/${projectId}/flows` : '/flows';
  const params = new URLSearchParams();
  if (flowId) params.set('flow', flowId);
  if (stepId) params.set('step', stepId);
  if (returnTo) params.set('returnTo', returnTo);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function withModelDataFlows(model: FlatC4Model, dataFlows: StoredDataFlow[]): FlatC4Model {
  return { ...model, dataFlows } as FlatC4Model;
}

export const DATA_FLOW_LIST_PAGE_SIZE = 40;

export type DataFlowSortKey = 'updated' | 'created' | 'name-asc' | 'name-desc' | 'steps';

export const DATA_FLOW_SORT_KEYS: DataFlowSortKey[] = [
  'updated',
  'created',
  'name-asc',
  'name-desc',
  'steps',
];

export function parseDataFlowSortKey(raw: string | null | undefined): DataFlowSortKey {
  return DATA_FLOW_SORT_KEYS.includes(raw as DataFlowSortKey)
    ? (raw as DataFlowSortKey)
    : 'updated';
}

function compareLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export function filterDataFlows(
  flows: StoredDataFlow[],
  query: string
): StoredDataFlow[] {
  const q = query.trim().toLowerCase();
  if (!q) return flows;
  return flows.filter((flow) => {
    if (flow.name.toLowerCase().includes(q)) return true;
    if ((flow.description || '').toLowerCase().includes(q)) return true;
    return flow.steps.some(
      (step) =>
        step.name.toLowerCase().includes(q) ||
        (step.description || '').toLowerCase().includes(q)
    );
  });
}

export function sortDataFlows(
  flows: StoredDataFlow[],
  sort: DataFlowSortKey
): StoredDataFlow[] {
  const next = flows.slice();
  next.sort((a, b) => {
    switch (sort) {
      case 'name-asc':
        return compareLocale(a.name, b.name) || compareLocale(a.id, b.id);
      case 'name-desc':
        return compareLocale(b.name, a.name) || compareLocale(a.id, b.id);
      case 'created':
        return (b.createdAt || '').localeCompare(a.createdAt || '') || compareLocale(a.id, b.id);
      case 'steps':
        return b.steps.length - a.steps.length || compareLocale(a.name, b.name);
      case 'updated':
      default:
        return (b.updatedAt || '').localeCompare(a.updatedAt || '') || compareLocale(a.id, b.id);
    }
  });
  return next;
}
