import type { ComponentBlock, ContainerBlock, FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { isUiElement, type UiExtras } from '@/types/c4Extensions';
import { containerIdsForOwner, type DocOwnerType } from './endpointRefs';

export type ResolvedUiRef = {
  id: string;
  name: string;
  description?: string;
  /** Stored tagged text — the embed parses it, the model keeps it whole. */
  design?: string;
  /** Resolved: the element's own system, else the one its container is built in. */
  designSystem?: string;
  containerId: string;
  containerName?: string;
};

export type UiOption = Pick<ResolvedUiRef, 'id' | 'name' | 'designSystem' | 'containerName'>;

/**
 * The design system is inherited, so it is resolved here rather than left to
 * whoever draws the embed: a screen in the admin console must not be read
 * against the public site's vocabulary.
 */
function componentToUiRef(
  component: ComponentBlock,
  container?: ContainerBlock
): ResolvedUiRef {
  const extras = component as ComponentBlock & UiExtras;
  const containerExtras = container as (ContainerBlock & UiExtras) | undefined;
  return {
    id: component.id,
    name: component.name,
    description: component.description,
    design: extras.design,
    designSystem: extras.designSystem || containerExtras?.designSystem,
    containerId: component.containerId,
    containerName: container?.name,
  };
}

export function collectUiIndex(model: FlatC4Model): Map<string, ResolvedUiRef> {
  const map = new Map<string, ResolvedUiRef>();
  for (const component of model.components) {
    if (!isUiElement(component)) continue;
    const container = model.containers.find((c) => c.id === component.containerId);
    map.set(component.id, componentToUiRef(component, container));
  }
  return map;
}

/** Scoped like endpoints: a screen belongs to the front end it is built in. */
export function collectUiOptionsForOwner(
  model: FlatC4Model,
  ownerType: DocOwnerType,
  ownerId: string
): UiOption[] {
  const containerIds = containerIdsForOwner(model, ownerType, ownerId);
  if (!containerIds) return [];

  const options: UiOption[] = [];
  for (const component of model.components) {
    if (!isUiElement(component) || !containerIds.has(component.containerId)) continue;
    const ref = componentToUiRef(
      component,
      model.containers.find((c) => c.id === component.containerId)
    );
    options.push({
      id: ref.id,
      name: ref.name,
      designSystem: ref.designSystem,
      containerName: ref.containerName,
    });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export function formatUiOptionLabel(option: UiOption): string {
  const line = option.designSystem ? `${option.name} · ${option.designSystem}` : option.name;
  return option.containerName ? `${line} — ${option.containerName}` : line;
}
