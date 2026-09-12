import type { ComponentBlock, ContainerBlock, FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { EndpointExtras, isApiEndpoint } from '@/types/c4Extensions';
import { containerDocument, resolveContractText } from '@utils/openapiRefs';

export type ResolvedEndpointRef = {
  id: string;
  name: string;
  description?: string;
  method: string;
  endpoint: string;
  request?: string;
  response?: string;
  headers?: string;
  containerId: string;
  containerName?: string;
};

export type EndpointOption = Pick<
  ResolvedEndpointRef,
  'id' | 'name' | 'method' | 'endpoint' | 'containerName'
>;

export type DocOwnerType = 'system' | 'container' | 'component' | 'code';

/**
 * `doc` is the service's stored contract, the only place a `$ref` in one of
 * these texts can point. Without it the embed would print the pointer; the
 * element keeps storing the ref either way.
 */
function componentToEndpointRef(
  component: ComponentBlock,
  containerName?: string,
  doc: Record<string, unknown> | null = null
): ResolvedEndpointRef {
  const extras = component as ComponentBlock & EndpointExtras;
  return {
    id: component.id,
    name: component.name,
    description: component.description,
    method: extras.method || 'GET',
    endpoint: extras.endpoint || '/',
    request: resolveContractText(extras.request, 'request', doc),
    response: resolveContractText(extras.response, 'response', doc),
    headers: extras.headers,
    containerId: component.containerId,
    containerName,
  };
}

function documentOf(container: ContainerBlock | undefined): Record<string, unknown> | null {
  return containerDocument((container as (ContainerBlock & { openapi?: string }) | undefined)?.openapi);
}

export function collectEndpointIndex(model: FlatC4Model): Map<string, ResolvedEndpointRef> {
  const map = new Map<string, ResolvedEndpointRef>();
  /* One parse per service, not per endpoint — a document is not small. */
  const docs = new Map<string, Record<string, unknown> | null>();
  for (const component of model.components) {
    if (!isApiEndpoint(component as ComponentBlock & EndpointExtras)) continue;
    const container = model.containers.find((c) => c.id === component.containerId);
    if (!docs.has(component.containerId)) docs.set(component.containerId, documentOf(container));
    map.set(
      component.id,
      componentToEndpointRef(component, container?.name, docs.get(component.containerId) ?? null)
    );
  }
  return map;
}

/** Which containers a doc on this owner may pull contracts from. */
export function containerIdsForOwner(
  model: FlatC4Model,
  ownerType: DocOwnerType,
  ownerId: string
): Set<string> | null {
  if (ownerType === 'container') return new Set([ownerId]);
  if (ownerType === 'system') {
    return new Set(
      model.containers.filter((c) => c.systemId === ownerId).map((c) => c.id)
    );
  }
  if (ownerType === 'component') {
    const component = model.components.find((c) => c.id === ownerId);
    return component ? new Set([component.containerId]) : new Set();
  }
  if (ownerType === 'code') {
    const code = model.codeElements.find((c) => c.id === ownerId);
    const component = code
      ? model.components.find((c) => c.id === code.componentId)
      : undefined;
    return component ? new Set([component.containerId]) : new Set();
  }
  return new Set();
}

export function collectEndpointOptionsForOwner(
  model: FlatC4Model,
  ownerType: DocOwnerType,
  ownerId: string
): EndpointOption[] {
  const containerIds = containerIdsForOwner(model, ownerType, ownerId);
  if (!containerIds) return [];

  const options: EndpointOption[] = [];
  for (const component of model.components) {
    if (!isApiEndpoint(component as ComponentBlock & EndpointExtras) || !containerIds.has(component.containerId)) continue;
    const ref = componentToEndpointRef(
      component,
      model.containers.find((c) => c.id === component.containerId)?.name
    );
    options.push({
      id: ref.id,
      name: ref.name,
      method: ref.method,
      endpoint: ref.endpoint,
      containerName: ref.containerName,
    });
  }

  return options.sort((a, b) => {
    const byMethod = a.method.localeCompare(b.method);
    if (byMethod) return byMethod;
    const byPath = a.endpoint.localeCompare(b.endpoint);
    if (byPath) return byPath;
    return a.name.localeCompare(b.name);
  });
}

export function formatEndpointOptionLabel(option: EndpointOption): string {
  const line = `${option.method || 'GET'} ${option.endpoint || '/'}`;
  if (option.name.trim() && option.name !== option.endpoint) {
    return `${line} · ${option.name}`;
  }
  return line;
}
