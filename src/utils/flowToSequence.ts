import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type {
  DataFlowStep,
  FlowOwnerType,
  FlowParticipantRef,
  StoredDataFlow,
  StoredSequenceDiagram,
} from '@/types/c4Extensions';
import { isApiEndpoint } from '@/types/c4Extensions';
import {
  c4TypeToPlantUmlKind,
  slugFromC4,
  type C4ParticipantKindHint,
} from '@plugins/sequence-editor/host/c4Catalog';
import { createStoredDiagram } from '@plugins/sequence-editor/host/diagramHelpers';
import { isDatabaseTechnology } from '@utils/databaseTech';
import { groupFlowStages, participantLabel } from '@utils/dataFlows';

export type SequenceOwner = {
  ownerType: 'container' | 'component';
  ownerId: string;
};

type ResolvedParticipant = {
  ref: FlowParticipantRef;
  entityId: string;
  name: string;
  c4Type: C4ParticipantKindHint | 'code';
  external?: boolean;
  isDatabase?: boolean;
  alias: string;
};

export type MagicSequencePlan = {
  owner: SequenceOwner;
  diagramId: string;
  diagramName: string;
  plantUmlSource: string;
  sourceKey: string;
  sequenceIds: string[];
  magicSequenceId: string;
  magicSequenceSourceKey: string;
  created: boolean;
};

export type MagicSequencePlanResult =
  | { ok: true; plan: MagicSequencePlan }
  | { ok: false; error: 'no_steps' | 'invalid_first_service' | 'empty_flow' };

/** Fingerprint of hop content — used to detect when regenerate is needed. */
export function flowSequenceSourceKey(flow: Pick<StoredDataFlow, 'name' | 'steps'>): string {
  return JSON.stringify({
    name: flow.name,
    steps: flow.steps.map((step) => ({
      id: step.id,
      name: step.name,
      description: step.description || '',
      kind: step.kind || 'hop',
      from: step.from,
      to: step.to,
      endpointIds: step.endpointIds || [],
      channelIds: step.channelIds || [],
      connections: step.connections || [],
      parallelGroupId: step.parallelGroupId || '',
      /* Part of the fingerprint: flipping AND↔OR changes the diagram, and so
         does moving a step from one track of the fork to another. */
      branchKind: step.branchKind || '',
      branchArmId: step.branchArmId || '',
      nextFlowRef: step.nextFlowRef
        ? {
            id: step.nextFlowRef.id,
            projectId: step.nextFlowRef.projectId,
            name: step.nextFlowRef.name,
            projectName: step.nextFlowRef.projectName,
          }
        : null,
    })),
  });
}

export function flowMagicSequenceIsStale(flow: StoredDataFlow): boolean {
  if (!flow.magicSequenceId) return true;
  return flow.magicSequenceSourceKey !== flowSequenceSourceKey(flow);
}

type OriginalRef = { id: string; type?: FlowOwnerType | string };

function originalRefOf(item: { original?: unknown } | null | undefined): OriginalRef | null {
  const raw = item?.original;
  if (!raw || typeof raw !== 'object') return null;
  const id = (raw as OriginalRef).id;
  if (typeof id !== 'string' || !id) return null;
  const type = (raw as OriginalRef).type;
  return type ? { id, type } : { id };
}

/** Clone card on a diagram that represents another C4 entity. */
function findCloneOwner(
  model: FlatC4Model,
  originalId: string,
  originalType?: FlowOwnerType
): SequenceOwner | null {
  for (const container of model.containers) {
    const orig = originalRefOf(container);
    if (!orig || orig.id !== originalId) continue;
    if (originalType && orig.type && orig.type !== originalType) continue;
    return { ownerType: 'container', ownerId: container.id };
  }
  for (const component of model.components) {
    const orig = originalRefOf(component);
    if (!orig || orig.id !== originalId) continue;
    if (originalType && orig.type && orig.type !== originalType) continue;
    return { ownerType: 'component', ownerId: component.id };
  }
  return null;
}

function findContainerClone(
  model: FlatC4Model,
  originalId: string,
  originalType?: FlowOwnerType
): (typeof model.containers)[number] | null {
  for (const container of model.containers) {
    const orig = originalRefOf(container);
    if (!orig || orig.id !== originalId) continue;
    if (originalType && orig.type && orig.type !== originalType) continue;
    return container;
  }
  return null;
}

function findComponentClone(
  model: FlatC4Model,
  originalId: string,
  originalType?: FlowOwnerType
): (typeof model.components)[number] | null {
  for (const component of model.components) {
    const orig = originalRefOf(component);
    if (!orig || orig.id !== originalId) continue;
    if (originalType && orig.type && orig.type !== originalType) continue;
    return component;
  }
  return null;
}

export function resolveSequenceOwner(
  model: FlatC4Model,
  ref: FlowParticipantRef | null | undefined
): SequenceOwner | null {
  if (!ref?.id) return null;

  if (ref.type === 'container') {
    if (model.containers.some((c) => c.id === ref.id)) {
      return { ownerType: 'container', ownerId: ref.id };
    }
    return findCloneOwner(model, ref.id, 'container');
  }
  if (ref.type === 'component') {
    if (model.components.some((c) => c.id === ref.id)) {
      return { ownerType: 'component', ownerId: ref.id };
    }
    const code = model.codeElements.find((c) => c.id === ref.id);
    if (code?.componentId && model.components.some((c) => c.id === code.componentId)) {
      return { ownerType: 'component', ownerId: code.componentId };
    }
    return findCloneOwner(model, ref.id, 'component');
  }
  if (ref.type === 'code') {
    const code = model.codeElements.find((c) => c.id === ref.id);
    if (!code?.componentId) return null;
    if (model.components.some((c) => c.id === code.componentId)) {
      return { ownerType: 'component', ownerId: code.componentId };
    }
    return findCloneOwner(model, code.componentId, 'component');
  }
  if (ref.type === 'system') {
    const containers = model.containers.filter((c) => c.systemId === ref.id && !c.original);
    if (containers.length) {
      const preferred =
        containers.find((c) => !isDatabaseTechnology(c.technology)) || containers[0];
      return { ownerType: 'container', ownerId: preferred!.id };
    }
    // System cloned onto another diagram (container card with original = this system).
    const cloneOwner = findCloneOwner(model, ref.id, 'system');
    if (cloneOwner) return cloneOwner;
  }
  return null;
}

/** Pick where to store the generated diagram for this flow. */
export function resolveFlowSequenceOwner(
  model: FlatC4Model,
  flow: StoredDataFlow
): SequenceOwner | null {
  const candidates: FlowParticipantRef[] = [];
  const seen = new Set<string>();
  const push = (ref: FlowParticipantRef | null | undefined) => {
    if (!ref?.id || !ref.type) return;
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(ref);
  };

  const first = flow.steps.find((step) => step.kind !== 'link') || flow.steps[0];
  if (first) {
    push(first.from);
    push(first.to);
  }
  for (const step of flow.steps) {
    if (step.kind === 'link') continue;
    push(step.from);
    push(step.to);
    for (const endpointId of step.endpointIds || []) {
      push({ id: endpointId, type: 'component' });
    }
    for (const channelId of step.channelIds || []) {
      push({ id: channelId, type: 'component' });
    }
  }

  for (const ref of candidates) {
    const owner = resolveSequenceOwner(model, ref);
    if (owner) return owner;
  }
  return null;
}

function entityFromContainerCard(
  model: FlatC4Model,
  container: (typeof model.containers)[number]
): {
  entityId: string;
  name: string;
  c4Type: FlowOwnerType;
  external?: boolean;
  isDatabase?: boolean;
} {
  const orig = originalRefOf(container);
  if (orig?.type === 'system') {
    const system = model.systems.find((entry) => entry.id === orig.id);
    if (system) {
      return {
        entityId: system.id,
        name: system.name,
        c4Type: 'system',
        external: Boolean((system as { external?: boolean }).external),
      };
    }
    /* Remote (or missing) system — the clone card is the local face of it. */
    return {
      entityId: orig.id,
      name: container.name,
      c4Type: 'system',
      external: true,
    };
  }
  if (orig?.type === 'container') {
    const source = model.containers.find((entry) => entry.id === orig.id && !entry.original);
    if (source) {
      return {
        entityId: source.id,
        name: source.name,
        c4Type: 'container',
        external: Boolean((source as { external?: boolean }).external),
        isDatabase: isDatabaseTechnology(source.technology),
      };
    }
    return {
      entityId: orig.id,
      name: container.name,
      c4Type: 'container',
      external: true,
      isDatabase: isDatabaseTechnology(container.technology),
    };
  }
  return {
    entityId: container.id,
    name: container.name,
    c4Type: 'container',
    external: Boolean((container as { external?: boolean }).external),
    isDatabase: isDatabaseTechnology(container.technology),
  };
}

function entityFromComponentCard(
  model: FlatC4Model,
  component: (typeof model.components)[number]
): {
  entityId: string;
  name: string;
  c4Type: FlowOwnerType;
  external?: boolean;
} {
  const orig = originalRefOf(component);
  if (orig?.type === 'component') {
    const source = model.components.find((entry) => entry.id === orig.id && !entry.original);
    if (source) {
      const extras = source as typeof source & { method?: string; endpoint?: string; kind?: string };
      const name = isApiEndpoint(extras)
        ? `${extras.method || '*'} ${extras.endpoint || source.name}`
        : source.name;
      return {
        entityId: source.id,
        name,
        c4Type: 'component',
        external: Boolean((source as { external?: boolean }).external),
      };
    }
    return {
      entityId: orig.id,
      name: component.name,
      c4Type: 'component',
      external: true,
    };
  }
  const extras = component as typeof component & { method?: string; endpoint?: string; kind?: string };
  const name = isApiEndpoint(extras)
    ? `${extras.method || '*'} ${extras.endpoint || component.name}`
    : component.name;
  return {
    entityId: component.id,
    name,
    c4Type: 'component',
    external: Boolean((component as { external?: boolean }).external),
  };
}

function findFlowEntity(
  model: FlatC4Model,
  ref: FlowParticipantRef
): {
  entityId: string;
  name: string;
  c4Type: FlowOwnerType;
  external?: boolean;
  isDatabase?: boolean;
} | null {
  if (!ref.id) return null;

  if (ref.type === 'system') {
    const system = model.systems.find((entry) => entry.id === ref.id);
    if (system && !system.original) {
      return {
        entityId: system.id,
        name: system.name,
        c4Type: 'system',
        external: Boolean((system as { external?: boolean }).external),
      };
    }
    /* System only present as a clone card on a container diagram. */
    const clone = findContainerClone(model, ref.id, 'system');
    if (clone) return entityFromContainerCard(model, clone);
    if (ref.name?.trim()) {
      return {
        entityId: ref.id,
        name: ref.name.trim(),
        c4Type: 'system',
        external: true,
      };
    }
    return null;
  }
  if (ref.type === 'container') {
    const container = model.containers.find((entry) => entry.id === ref.id);
    if (container) return entityFromContainerCard(model, container);
    const clone = findContainerClone(model, ref.id, 'container');
    if (clone) return entityFromContainerCard(model, clone);
    /* System cloned onto this diagram, but the hop named it as a container. */
    const asSystemClone = findContainerClone(model, ref.id, 'system');
    if (asSystemClone) return entityFromContainerCard(model, asSystemClone);
    if (ref.name?.trim()) {
      return {
        entityId: ref.id,
        name: ref.name.trim(),
        c4Type: 'container',
        external: Boolean(ref.projectId),
      };
    }
    return null;
  }
  if (ref.type === 'component') {
    const component = model.components.find((entry) => entry.id === ref.id);
    if (component) return entityFromComponentCard(model, component);
    const clone = findComponentClone(model, ref.id, 'component');
    if (clone) return entityFromComponentCard(model, clone);
    if (ref.name?.trim()) {
      return {
        entityId: ref.id,
        name: ref.name.trim(),
        c4Type: 'component',
        external: Boolean(ref.projectId),
      };
    }
    return null;
  }
  const code = model.codeElements.find((entry) => entry.id === ref.id);
  if (!code || code.original) return null;
  return {
    entityId: code.id,
    name: code.name,
    c4Type: 'code',
  };
}

function resolveParticipantEntity(
  model: FlatC4Model,
  ref: FlowParticipantRef
): {
  entityId: string;
  name: string;
  c4Type: C4ParticipantKindHint | 'code';
  external?: boolean;
  isDatabase?: boolean;
} | null {
  const entity = findFlowEntity(model, ref);
  if (!entity) return null;
  if (entity.c4Type === 'code') {
    return {
      entityId: entity.entityId,
      name: entity.name,
      c4Type: 'code',
    };
  }
  return {
    entityId: entity.entityId,
    name: entity.name,
    c4Type: entity.c4Type,
    external: entity.external,
    isDatabase: entity.isDatabase,
  };
}

function participantKey(ref: FlowParticipantRef): string {
  return `${ref.type}:${ref.id}`;
}

function allocAlias(
  name: string,
  entityId: string,
  usedAliases: Set<string>
): string {
  let alias = slugFromC4(name, entityId);
  let n = 2;
  while (usedAliases.has(alias)) {
    alias = `${slugFromC4(name, entityId)}_${n++}`;
  }
  usedAliases.add(alias);
  return alias;
}

function resolveParticipant(
  model: FlatC4Model,
  ref: FlowParticipantRef,
  cache: Map<string, ResolvedParticipant>,
  usedAliases: Set<string>
): ResolvedParticipant | null {
  const key = participantKey(ref);
  const cached = cache.get(key);
  if (cached) return cached;

  const entity = resolveParticipantEntity(model, ref);
  if (!entity) return null;

  const alias = allocAlias(entity.name, entity.entityId, usedAliases);
  const resolved: ResolvedParticipant = {
    ref,
    entityId: entity.entityId,
    name: entity.name,
    c4Type: entity.c4Type,
    external: entity.external,
    isDatabase: entity.isDatabase,
    alias,
  };
  cache.set(key, resolved);
  return resolved;
}

function formatParticipantLine(p: ResolvedParticipant): string {
  const kind =
    p.c4Type === 'code'
      ? 'control'
      : c4TypeToPlantUmlKind(p.c4Type, p.external, { isDatabase: p.isDatabase });
  return `${kind} "${p.name}" as ${p.alias}`;
}

/**
 * Hop descriptions are free-form paragraphs; PlantUML messages are one line.
 * Blank lines between paragraphs became extra tokens after the message and
 * broke the sequence editor — keep the prose, drop the empty lines.
 */
function sanitizeHopDescription(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stepMessageLabel(model: FlatC4Model, step: DataFlowStep): string {
  const parts: string[] = [];
  if (step.name.trim()) parts.push(step.name.trim());
  const description = step.description ? sanitizeHopDescription(step.description) : '';
  if (description) parts.push(description);

  const endpoints = (step.endpointIds || [])
    .map((id) => {
      const comp = model.components.find((c) => c.id === id) as
        | (typeof model.components)[number] & { method?: string; endpoint?: string; kind?: string }
        | undefined;
      if (!comp) return null;
      if (isApiEndpoint(comp)) return `${comp.method || '*'} ${comp.endpoint || comp.name}`;
      return comp.name;
    })
    .filter((item): item is string => Boolean(item));
  if (endpoints.length) parts.push(endpoints.join(', '));

  const channels = (step.channelIds || [])
    .map((id) => model.components.find((c) => c.id === id)?.name)
    .filter((item): item is string => Boolean(item));
  if (channels.length) parts.push(channels.join(', '));

  /* Empty means empty. A single space produced `A -> B: ` — a colon with
     nothing after it, which the lexer reports as an unexpected token. */
  return parts.join(' — ').slice(0, 240).trim();
}

function formatStepMessages(
  model: FlatC4Model,
  step: DataFlowStep,
  cache: Map<string, ResolvedParticipant>,
  usedAliases: Set<string>,
  previousAlias: string | null
): { lines: string[]; nextAlias: string | null } {
  if (step.kind === 'link') {
    return { lines: [], nextAlias: previousAlias };
  }

  const from = resolveParticipant(model, step.from, cache, usedAliases);
  const to = resolveParticipant(model, step.to, cache, usedAliases);
  if (!from || !to) return { lines: [], nextAlias: previousAlias };

  const label = stepMessageLabel(model, step);
  /* The endpoint or topic rides in the label, which already spells it out as
     `POST /api/payments`. It is the message, not a lifeline of its own. */
  return {
    lines: [label ? `${from.alias} -> ${to.alias}: ${label}` : `${from.alias} -> ${to.alias}`],
    nextAlias: to.alias,
  };
}

function collectParticipantsInOrder(
  model: FlatC4Model,
  flow: StoredDataFlow,
  cache: Map<string, ResolvedParticipant>,
  usedAliases: Set<string>
): ResolvedParticipant[] {
  const seen = new Set<string>();
  const out: ResolvedParticipant[] = [];
  const pushRef = (ref: FlowParticipantRef | null | undefined) => {
    if (!ref?.id || !ref.type) return;
    const key = participantKey(ref);
    if (seen.has(key)) return;
    const resolved = resolveParticipant(model, ref, cache, usedAliases);
    if (!resolved) return;
    seen.add(key);
    out.push(resolved);
  };

  /* Only the two ends of a hop are lifelines. An endpoint or a topic is what
     travels between them — declaring it as a participant invented an element
     the C4 model does not have, and the diagram's own validator said so.
     Link steps jump to another Magic flow and are omitted from the diagram. */
  for (const step of flow.steps) {
    if (step.kind === 'link') continue;
    pushRef(step.from);
    pushRef(step.to);
  }
  return out;
}

export function generatePlantUmlFromFlow(
  model: FlatC4Model,
  flow: StoredDataFlow
): string {
  const cache = new Map<string, ResolvedParticipant>();
  const usedAliases = new Set<string>();
  const participants = collectParticipantsInOrder(model, flow, cache, usedAliases);

  const lines: string[] = ['@startuml'];
  const title = flow.name.trim() || 'Magic flow';
  lines.push(`title ${title}`);

  if (participants.length) lines.push('');
  for (const p of participants) {
    lines.push(formatParticipantLine(p));
  }

  const stages = groupFlowStages(flow.steps).filter(
    (stage) => !stage.steps.every((step) => step.kind === 'link')
  );
  if (stages.length) lines.push('');

  let previousAlias: string | null = null;
  stages.forEach((stage, stageIndex) => {
    if (stageIndex > 0) {
      const first = stage.steps.find((step) => step.kind !== 'link') || stage.steps[0];
      const divider = first?.name.trim() || `Step ${stageIndex + 1}`;
      lines.push(`== ${divider} ==`);
    }

    const hopSteps = stage.steps.filter((step) => step.kind !== 'link');
    if (!hopSteps.length) return;

    const armHops = stage.arms
      .map((arm) => arm.steps.filter((step) => step.kind !== 'link'))
      .filter((arm) => arm.length > 0);

    if (stage.branched && armHops.length > 1) {
      const alternative = stage.kind === 'alternative';
      armHops.forEach((arm, branchIndex) => {
        /* They do not spell it the same way: `alt` divides its branches with
           `else`, `par` with `and`. Writing `else` under `par` produced source
           the editor could not parse. */
        const opener = alternative ? 'alt' : 'par';
        const separator = alternative ? 'else' : 'and';
        const fallback = alternative ? 'Alternative' : 'Parallel';
        /* The first step of the track names the branch — it is the condition
           the reader chose on — and the rest of the track are its messages. */
        const head =
          branchIndex === 0
            ? `${opener} ${arm[0]!.name.trim() || fallback}`
            : `${separator} ${arm[0]!.name.trim() || ''}`.trimEnd();
        lines.push(head);
        for (const step of arm) {
          const formatted = formatStepMessages(model, step, cache, usedAliases, previousAlias);
          for (const msg of formatted.lines) {
            lines.push(`  ${msg}`);
          }
          if (formatted.nextAlias) previousAlias = formatted.nextAlias;
        }
      });
      lines.push('end');
      return;
    }

    for (const step of hopSteps) {
      const formatted = formatStepMessages(model, step, cache, usedAliases, previousAlias);
      for (const msg of formatted.lines) {
        lines.push(msg);
      }
      if (formatted.nextAlias) previousAlias = formatted.nextAlias;
    }
  });

  lines.push('@enduml');
  return `${lines.join('\n')}\n`;
}

export function planMagicSequence(
  model: FlatC4Model,
  flow: StoredDataFlow,
  author?: StoredSequenceDiagram['createdBy']
): MagicSequencePlanResult {
  if (!flow.steps.length) return { ok: false, error: 'no_steps' };

  const owner = resolveFlowSequenceOwner(model, flow);
  if (!owner) return { ok: false, error: 'invalid_first_service' };

  const sourceKey = flowSequenceSourceKey(flow);
  const plantUmlSource = generatePlantUmlFromFlow(model, flow);
  const diagramName = `${flow.name.trim() || 'Magic flow'} — sequence`;
  const existingId = flow.magicSequenceId;
  const diagramId = existingId || createStoredDiagram(diagramName, plantUmlSource, author).id;
  const created = !existingId;

  const sequenceIds = [...(flow.sequenceIds || [])];
  if (!sequenceIds.includes(diagramId)) sequenceIds.unshift(diagramId);

  return {
    ok: true,
    plan: {
      owner,
      diagramId,
      diagramName,
      plantUmlSource,
      sourceKey,
      sequenceIds,
      magicSequenceId: diagramId,
      magicSequenceSourceKey: sourceKey,
      created,
    },
  };
}

export function firstServiceLabel(model: FlatC4Model, flow: StoredDataFlow): string {
  const first = flow.steps[0];
  if (!first) return '';
  return participantLabel(model, first.from);
}
