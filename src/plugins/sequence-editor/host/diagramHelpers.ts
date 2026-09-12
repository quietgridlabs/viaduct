import type { PersonRef, StoredSequenceDiagram } from '@/types/c4Extensions';

export type { StoredSequenceDiagram };

export function createEmptyDiagramSource(title: string): string {
  return `@startuml
title ${title}

@enduml
`;
}

export function createStoredDiagram(
  name: string,
  source?: string,
  author?: PersonRef | null
): StoredSequenceDiagram {
  const now = new Date().toISOString();
  return {
    id: `seq_${Math.random().toString(36).slice(2, 10)}`,
    name,
    plantUmlSource: source ?? createEmptyDiagramSource(name),
    modelVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...(author ? { createdBy: author, updatedBy: author } : {}),
  };
}
