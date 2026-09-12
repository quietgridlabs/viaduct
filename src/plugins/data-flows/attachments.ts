import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { SequenceDiagramExtras, StoredSequenceDiagram } from '@/types/c4Extensions';
import { listInlineDocumentation } from '@plugins/docs-editor/localDocs';

export type FlowDocOption = {
  id: string;
  title: string;
  markdown: string;
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  ownerName: string;
  label: string;
};

export type FlowSequenceOption = {
  id: string;
  name: string;
  plantUmlSource: string;
  ownerType: 'container' | 'component';
  ownerId: string;
  ownerName: string;
  label: string;
  createdAt?: string;
  updatedAt?: string;
};

export function listProjectDocs(model: FlatC4Model): FlowDocOption[] {
  return listInlineDocumentation(model).map((doc) => ({
    id: doc.id,
    title: doc.title,
    markdown: doc.markdown,
    ownerType: doc.ownerType,
    ownerId: doc.ownerId,
    ownerName: doc.ownerName,
    label: doc.ownerName ? `${doc.title} · ${doc.ownerName}` : doc.title,
  }));
}

export function listProjectSequences(model: FlatC4Model): FlowSequenceOption[] {
  const out: FlowSequenceOption[] = [];
  const push = (
    ownerType: 'container' | 'component',
    ownerId: string,
    ownerName: string,
    diagrams: StoredSequenceDiagram[] | undefined
  ) => {
    for (const d of diagrams ?? []) {
      out.push({
        id: d.id,
        name: d.name,
        plantUmlSource: d.plantUmlSource,
        ownerType,
        ownerId,
        ownerName,
        label: ownerName ? `${d.name} · ${ownerName}` : d.name,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      });
    }
  };
  for (const c of model.containers) {
    push(
      'container',
      c.id,
      c.name,
      (c as typeof c & SequenceDiagramExtras).sequenceDiagrams
    );
  }
  for (const c of model.components) {
    push(
      'component',
      c.id,
      c.name,
      (c as typeof c & SequenceDiagramExtras).sequenceDiagrams
    );
  }
  return out;
}

export function resolveFlowDocs(model: FlatC4Model, ids: string[] | undefined): FlowDocOption[] {
  if (!ids?.length) return [];
  const index = new Map(listProjectDocs(model).map((d) => [d.id, d]));
  return ids.map((id) => index.get(id)).filter((d): d is FlowDocOption => Boolean(d));
}

export function resolveFlowSequences(
  model: FlatC4Model,
  ids: string[] | undefined
): FlowSequenceOption[] {
  if (!ids?.length) return [];
  const index = new Map(listProjectSequences(model).map((d) => [d.id, d]));
  return ids.map((id) => index.get(id)).filter((d): d is FlowSequenceOption => Boolean(d));
}
