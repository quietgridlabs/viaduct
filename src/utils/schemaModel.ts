import type { ConnectionData, FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { ConnectionExtras, TableColumn, TableExtras } from '@/types/c4Extensions';

export function getTableColumns(
  component: { columns?: TableColumn[] } | null | undefined
): TableColumn[] {
  return Array.isArray(component?.columns) ? component.columns : [];
}

export function findComponentConnection(
  model: FlatC4Model,
  sourceId: string,
  targetId: string
): (ConnectionData & ConnectionExtras) | null {
  const source = model.components.find((c) => c.id === sourceId);
  const conn = source?.connections?.find((c) => c.targetId === targetId);
  if (!conn) return null;
  const extras = conn as ConnectionExtras;
  return {
    ...conn,
    foreignKey: extras.foreignKey,
    relatedComponentIds: extras.relatedComponentIds,
    pathType: extras.pathType,
  };
}

export function fkEdgeLabel(
  model: FlatC4Model,
  sourceId: string,
  targetId: string,
  fk?: ConnectionExtras['foreignKey']
): string | undefined {
  if (!fk) return undefined;
  const source = model.components.find((c) => c.id === sourceId);
  const target = model.components.find((c) => c.id === targetId);
  const srcCol = getTableColumns(source as TableExtras | undefined).find(
    (c) => c.id === fk.sourceColumnId
  );
  const tgtCol = getTableColumns(target as TableExtras | undefined).find(
    (c) => c.id === fk.targetColumnId
  );
  if (!srcCol || !tgtCol) return 'FK';
  return `${srcCol.name} → ${tgtCol.name}`;
}
