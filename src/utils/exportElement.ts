import type { ContainerBlock, FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import {
  buildServiceDocument,
  containerEndpoints,
  documentJson,
  serviceMetaFor,
  storedDocument,
  toPayload,
} from '@utils/serviceContract';
import { docsApi, type ProjectDocumentation } from '@shared/api';
import type {
  DocumentationExtras,
  InlineDocumentation,
  SequenceDiagramExtras,
  StoredSequenceDiagram,
} from '@/types/c4Extensions';
import { listEntityDocumentations, setEntityDocumentations } from '@plugins/docs-editor/entityDocs';
import {
  parseSequenceRefFenceBody,
  SEQUENCE_REF_FENCE,
} from '@plugins/docs-editor/markdown';
import { CURRENT_SCHEMA_VERSION } from '@utils/jsonIO';
import { zipSync, strToU8 } from 'fflate';

export type ElementOwnerType = 'system' | 'container' | 'component' | 'code';
export type ElementExportMode = 'element' | 'subtree';

const RUNTIME_KEYS = new Set([
  'onEdit',
  'traceHighlight',
  'traceDimmed',
  'traceContainerLabel',
]);

type WithConnections = { id: string; connections?: { targetId: string }[] };

type ExportableEntity = DocumentationExtras &
  SequenceDiagramExtras & {
    id: string;
    name?: string;
  };

type OwnedEntity = {
  ownerType: ElementOwnerType;
  entity: ExportableEntity;
};

function slugify(value: string): string {
  const s = value
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (s || 'item').slice(0, 48);
}

function sanitizeEntity(entity: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entity)) {
    if (RUNTIME_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function filterConnections<T extends WithConnections>(entities: T[], allowedIds: Set<string>): T[] {
  return entities.map((e) => ({
    ...e,
    connections: (e.connections || []).filter((c) => allowedIds.has(c.targetId)),
  }));
}

function findEntity(
  model: FlatC4Model,
  ownerType: ElementOwnerType,
  ownerId: string
): ExportableEntity | null {
  const list =
    ownerType === 'system'
      ? model.systems
      : ownerType === 'container'
        ? model.containers
        : ownerType === 'component'
          ? model.components
          : model.codeElements;
  const found = list.find((e) => e.id === ownerId);
  if (!found) return null;
  return found as ExportableEntity;
}

/** Slice of the flat model rooted at the given element (no ancestors). */
export function collectSubtreeModel(
  model: FlatC4Model,
  ownerType: ElementOwnerType,
  ownerId: string
): FlatC4Model {
  let systems = model.systems.filter((s) => s.id === ownerId);
  let containers = model.containers.filter((c) => c.id === ownerId);
  let components = model.components.filter((c) => c.id === ownerId);
  let codeElements = model.codeElements.filter((c) => c.id === ownerId);

  if (ownerType === 'system') {
    systems = model.systems.filter((s) => s.id === ownerId);
    containers = model.containers.filter((c) => c.systemId === ownerId);
    const containerIds = new Set(containers.map((c) => c.id));
    components = model.components.filter((c) => containerIds.has(c.containerId));
    const componentIds = new Set(components.map((c) => c.id));
    codeElements = model.codeElements.filter((c) => componentIds.has(c.componentId));
  } else if (ownerType === 'container') {
    systems = [];
    containers = model.containers.filter((c) => c.id === ownerId);
    components = model.components.filter((c) => c.containerId === ownerId);
    const componentIds = new Set(components.map((c) => c.id));
    codeElements = model.codeElements.filter((c) => componentIds.has(c.componentId));
  } else if (ownerType === 'component') {
    systems = [];
    containers = [];
    components = model.components.filter((c) => c.id === ownerId);
    codeElements = model.codeElements.filter((c) => c.componentId === ownerId);
  } else {
    systems = [];
    containers = [];
    components = [];
    codeElements = model.codeElements.filter((c) => c.id === ownerId);
  }

  const allowedIds = new Set([
    ...systems.map((e) => e.id),
    ...containers.map((e) => e.id),
    ...components.map((e) => e.id),
    ...codeElements.map((e) => e.id),
  ]);

  return {
    ...model,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    viewLevel: ownerType,
    activeSystemId: ownerType === 'system' ? ownerId : null,
    activeContainerId: ownerType === 'container' ? ownerId : null,
    activeComponentId: ownerType === 'component' ? ownerId : null,
    systems: filterConnections(systems, allowedIds),
    containers: filterConnections(containers, allowedIds),
    components: filterConnections(components, allowedIds),
    codeElements: filterConnections(codeElements, allowedIds),
  } as FlatC4Model;
}

function listOwnedEntities(slice: FlatC4Model): OwnedEntity[] {
  const out: OwnedEntity[] = [];
  for (const e of slice.systems) {
    out.push({ ownerType: 'system', entity: e as ExportableEntity });
  }
  for (const e of slice.containers) {
    out.push({ ownerType: 'container', entity: e as ExportableEntity });
  }
  for (const e of slice.components) {
    out.push({ ownerType: 'component', entity: e as ExportableEntity });
  }
  for (const e of slice.codeElements) {
    out.push({ ownerType: 'code', entity: e as ExportableEntity });
  }
  return out;
}

function collectSequencesFromEntities(entities: OwnedEntity[]): Map<string, StoredSequenceDiagram> {
  const map = new Map<string, StoredSequenceDiagram>();
  for (const { entity } of entities) {
    for (const d of entity.sequenceDiagrams ?? []) {
      map.set(d.id, d);
    }
  }
  return map;
}

function collectAllSequences(model: FlatC4Model): Map<string, StoredSequenceDiagram> {
  const map = new Map<string, StoredSequenceDiagram>();
  for (const c of model.containers) {
    for (const d of ((c as SequenceDiagramExtras).sequenceDiagrams ?? [])) {
      map.set(d.id, d);
    }
  }
  for (const c of model.components) {
    for (const d of ((c as SequenceDiagramExtras).sequenceDiagrams ?? [])) {
      map.set(d.id, d);
    }
  }
  return map;
}

function extractSequenceRefIds(markdown: string): string[] {
  const ids: string[] = [];
  const fence = '```' + SEQUENCE_REF_FENCE;
  let i = 0;
  while (i < markdown.length) {
    const start = markdown.indexOf(fence, i);
    if (start < 0) break;
    const bodyStart = start + fence.length;
    const end = markdown.indexOf('```', bodyStart);
    if (end < 0) break;
    const id = parseSequenceRefFenceBody(markdown.slice(bodyStart, end));
    if (id) ids.push(id);
    i = end + 3;
  }
  return ids;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function docFromApi(d: ProjectDocumentation): InlineDocumentation {
  return {
    id: d.id,
    title: d.title,
    markdown: d.markdown,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    createdBy: d.created_by_username
      ? {
          name: d.created_by_name || d.created_by_username,
          username: d.created_by_username,
        }
      : undefined,
    updatedBy: d.updated_by_username
      ? {
          name: d.updated_by_name || d.updated_by_username,
          username: d.updated_by_username,
        }
      : undefined,
  };
}

async function resolveDocsForOwned(
  owned: OwnedEntity[],
  projectId?: string | null
): Promise<Map<string, InlineDocumentation[]>> {
  const result = new Map<string, InlineDocumentation[]>();
  for (const { ownerType, entity } of owned) {
    result.set(`${ownerType}:${entity.id}`, listEntityDocumentations(entity));
  }
  if (!projectId) return result;

  try {
    const { docs } = await docsApi.listProjectDocs(projectId);
    for (const d of docs) {
      const key = `${d.owner_type}:${d.owner_id}`;
      if (!result.has(key)) continue;
      const list = result.get(key) ?? [];
      const byId = new Map(list.map((x) => [x.id, x]));
      byId.set(d.id, docFromApi(d));
      result.set(key, [...byId.values()]);
    }
  } catch {
    /* keep local */
  }
  return result;
}

function writeDocFiles(
  files: Record<string, Uint8Array>,
  docsByOwner: Map<string, InlineDocumentation[]>,
  prefix = 'docs'
) {
  for (const [ownerKey, docs] of docsByOwner) {
    const [ownerType, ownerId] = ownerKey.split(':');
    for (const doc of docs) {
      const dir =
        docsByOwner.size > 1
          ? `${prefix}/${ownerType}_${slugify(ownerId)}_${doc.id}_${slugify(doc.title || 'doc')}.md`
          : `${prefix}/${doc.id}_${slugify(doc.title || 'doc')}.md`;
      const header = [
        `<!-- id: ${doc.id} -->`,
        `<!-- owner: ${ownerType}:${ownerId} -->`,
        `<!-- title: ${doc.title || ''} -->`,
        '',
      ].join('\n');
      files[dir] = strToU8(header + (doc.markdown || ''));
    }
  }
}

type ServiceContract = { containerId: string; name: string; json: string };

/**
 * The OpenAPI document of every container being exported.
 *
 * Rebuilt from the endpoints on the way out so the archive carries the contract
 * as it is now, not as it was when it was last stored; without the API (guest,
 * offline) the stored document goes in unchanged, and a container with neither
 * contributes no file.
 */
async function collectServiceContracts(
  model: FlatC4Model,
  containers: ContainerBlock[]
): Promise<ServiceContract[]> {
  const out: ServiceContract[] = [];
  for (const container of containers) {
    const stored = storedDocument(container);
    const endpoints = containerEndpoints(model, container.id);
    if (!stored && !endpoints.length) continue;

    let json = stored ?? '';
    try {
      const { doc } = await buildServiceDocument(
        endpoints.map(toPayload),
        serviceMetaFor(container),
        stored
      );
      json = documentJson(doc);
    } catch {
      /* keep the stored document */
    }
    if (json.trim()) {
      out.push({ containerId: container.id, name: container.name || container.id, json });
    }
  }
  return out;
}

function writeContractFiles(
  files: Record<string, Uint8Array>,
  contracts: ServiceContract[]
): string[] {
  const names = contracts.map((contract) =>
    contracts.length > 1
      ? `contracts/${slugify(contract.name)}_swagger.json`
      : 'swagger.json'
  );
  contracts.forEach((contract, index) => {
    files[names[index]] = strToU8(contract.json);
  });
  return names;
}

function writeSequenceFiles(
  files: Record<string, Uint8Array>,
  sequences: StoredSequenceDiagram[]
) {
  for (const seq of sequences) {
    const name = `sequences/${seq.id}_${slugify(seq.name || 'sequence')}.puml`;
    files[name] = strToU8(seq.plantUmlSource || '');
  }
}

function gatherSequences(
  docsByOwner: Map<string, InlineDocumentation[]>,
  attached: Map<string, StoredSequenceDiagram>,
  fullModel: FlatC4Model
): StoredSequenceDiagram[] {
  const all = collectAllSequences(fullModel);
  const out = new Map(attached);
  for (const docs of docsByOwner.values()) {
    for (const doc of docs) {
      for (const id of extractSequenceRefIds(doc.markdown || '')) {
        const found = all.get(id) || attached.get(id);
        if (found) out.set(id, found);
      }
    }
  }
  return [...out.values()];
}

function applyDocsToSlice(
  slice: FlatC4Model,
  docsByOwner: Map<string, InlineDocumentation[]>
): FlatC4Model {
  const patch = <T extends { id: string }>(
    entities: T[],
    ownerType: ElementOwnerType
  ): T[] =>
    entities.map((e) => {
      const docs = docsByOwner.get(`${ownerType}:${e.id}`);
      if (!docs?.length) return e;
      return { ...e, ...setEntityDocumentations(docs) };
    });

  return {
    ...slice,
    systems: patch(slice.systems, 'system'),
    containers: patch(slice.containers, 'container'),
    components: patch(slice.components, 'component'),
    codeElements: patch(slice.codeElements, 'code'),
  };
}

/**
 * Zip archive for one C4 element, optionally with the full descendant subtree.
 * - element: root only + its docs/sequences
 * - subtree: model slice from root downward + docs/sequences for every included entity
 */
export async function exportElementArchive(opts: {
  model: FlatC4Model;
  ownerType: ElementOwnerType;
  ownerId: string;
  projectId?: string | null;
  mode?: ElementExportMode;
}): Promise<{ filename: string }> {
  const mode: ElementExportMode = opts.mode ?? 'element';
  const root = findEntity(opts.model, opts.ownerType, opts.ownerId);
  if (!root) throw new Error('element_not_found');

  if (mode === 'element') {
    const owned: OwnedEntity[] = [{ ownerType: opts.ownerType, entity: root }];
    const docsByOwner = await resolveDocsForOwned(owned, opts.projectId);
    const docs = docsByOwner.get(`${opts.ownerType}:${opts.ownerId}`) ?? [];
    const attached = new Map(
      (root.sequenceDiagrams ?? []).map((d) => [d.id, d] as const)
    );
    const sequences = gatherSequences(docsByOwner, attached, opts.model);

    const elementPayload = {
      ...sanitizeEntity(root),
      documentations: docs,
      documentationId: docs[0]?.id,
      documentation: docs[0],
      sequenceDiagrams: root.sequenceDiagrams ?? [],
    };

    /* A container is a service, so its OpenAPI contract travels with it. */
    const contracts =
      opts.ownerType === 'container'
        ? await collectServiceContracts(opts.model, [root as unknown as ContainerBlock])
        : [];

    const files: Record<string, Uint8Array> = {
      'element.json': strToU8(JSON.stringify(elementPayload, null, 2)),
    };
    const contractFiles = writeContractFiles(files, contracts);

    const manifest = {
      format: 'c4-modelizer-element',
      version: 1,
      mode: 'element' as const,
      exportedAt: new Date().toISOString(),
      ownerType: opts.ownerType,
      ownerId: opts.ownerId,
      ownerName: root.name || opts.ownerId,
      documentationIds: docs.map((d) => d.id),
      sequenceIds: sequences.map((d) => d.id),
      attachedSequenceIds: (root.sequenceDiagrams ?? []).map((d) => d.id),
      ...(contractFiles.length ? { serviceContracts: contractFiles } : {}),
    };

    files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
    writeDocFiles(files, docsByOwner);
    writeSequenceFiles(files, sequences);

    const zipped = zipSync(files, { level: 6 });
    const filename = `c4-${opts.ownerType}-${slugify(root.name || opts.ownerId)}.zip`;
    downloadBlob(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }), filename);
    return { filename };
  }

  const slice = collectSubtreeModel(opts.model, opts.ownerType, opts.ownerId);
  const owned = listOwnedEntities(slice);
  const docsByOwner = await resolveDocsForOwned(owned, opts.projectId);
  const attached = collectSequencesFromEntities(owned);
  const sequences = gatherSequences(docsByOwner, attached, opts.model);
  const modelPayload = applyDocsToSlice(slice, docsByOwner);

  const entityCounts = {
    systems: modelPayload.systems.length,
    containers: modelPayload.containers.length,
    components: modelPayload.components.length,
    codeElements: modelPayload.codeElements.length,
  };

  const allDocIds = [...docsByOwner.values()].flat().map((d) => d.id);

  /* Every service inside the exported slice brings its own contract. */
  const contracts = await collectServiceContracts(
    opts.model,
    modelPayload.containers as unknown as ContainerBlock[]
  );

  const files: Record<string, Uint8Array> = {
    'model.json': strToU8(JSON.stringify(modelPayload, null, 2)),
    'element.json': strToU8(
      JSON.stringify(
        {
          ...sanitizeEntity(root),
          documentations: docsByOwner.get(`${opts.ownerType}:${opts.ownerId}`) ?? [],
        },
        null,
        2
      )
    ),
  };
  const contractFiles = writeContractFiles(files, contracts);

  const manifest = {
    format: 'c4-modelizer-element',
    version: 1,
    mode: 'subtree' as const,
    exportedAt: new Date().toISOString(),
    ownerType: opts.ownerType,
    ownerId: opts.ownerId,
    ownerName: root.name || opts.ownerId,
    entityCounts,
    documentationIds: allDocIds,
    sequenceIds: sequences.map((d) => d.id),
    attachedSequenceIds: [...attached.keys()],
    ...(contractFiles.length ? { serviceContracts: contractFiles } : {}),
  };

  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  writeDocFiles(files, docsByOwner);
  writeSequenceFiles(files, sequences);

  const zipped = zipSync(files, { level: 6 });
  const filename = `c4-${opts.ownerType}-${slugify(root.name || opts.ownerId)}-subtree.zip`;
  downloadBlob(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }), filename);
  return { filename };
}
