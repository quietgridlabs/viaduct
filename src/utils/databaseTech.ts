import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import * as databasesJson from '@data/technologies/databases.json';

export function techIdsFromJson(mod: unknown): Set<string> {
  const list: { id: string }[] = Array.isArray(mod)
    ? (mod as { id: string }[])
    : !mod || typeof mod !== 'object'
      ? []
      : Array.isArray((mod as { default?: unknown }).default)
        ? ((mod as { default: { id: string }[] }).default)
        : Object.values(mod).filter(
            (v): v is { id: string } => Boolean(v) && typeof v === 'object' && 'id' in v
          );
  return new Set(list.map((d) => d.id));
}

const DATABASE_TECH_IDS = techIdsFromJson(databasesJson);

export function isDatabaseTechnology(technologyId?: string | null): boolean {
  if (!technologyId) return false;
  return DATABASE_TECH_IDS.has(technologyId);
}

/** Component-layer view of a DB container → ER schema editor. */
export function isDatabaseSchemaView(
  model: Pick<FlatC4Model, 'viewLevel' | 'activeContainerId' | 'containers'>
): boolean {
  if (model.viewLevel !== 'component' || !model.activeContainerId) return false;
  const container = model.containers.find((c) => c.id === model.activeContainerId);
  return isDatabaseTechnology(container?.technology);
}
