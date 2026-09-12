import { getElementLinks, sanitizeLinks } from '@/types/c4Extensions';
import {
  CodeBlock,
  ComponentBlock,
  ContainerBlock,
  FlatC4Model,
  SystemBlock,
} from '@archivisio/c4-modelizer-sdk';
import type { User } from '@shared/api';
import CodeEditDialog from '@components/code/CodeEditDialog';
import ComponentEditDialog from '@components/component/ComponentEditDialog';
import ChannelEditDialog from '@components/component/ChannelEditDialog';
import EndpointEditDialog from '@components/component/EndpointEditDialog';
import ConnectionEditDialog, {
  type RelatedComponentOption,
} from '@components/ConnectionEditDialog';
import ContainerEditDialog from '@components/container/ContainerEditDialog';
import FkEditDialog from '@components/er/FkEditDialog';
import TableEditDialog from '@components/er/TableEditDialog';
import SystemEditDialog from '@components/system/SystemEditDialog';
import type {
  AuditExtras,
  ChannelExtras,
  ConnectionExtras,
  EndpointExtras,
  LinkExtras,
  ModelWithDesignSystems,
  TableExtras,
  UiExtras,
} from '@/types/c4Extensions';
import {
  getElementGroup,
  getElementTags,
  isApiEndpoint,
  isBrokerChannel,
  listDesignSystems,
  sanitizeTags,
  normalizeGroup,
} from '@/types/c4Extensions';
import { domainsForLevel, getElementDomainId } from '@utils/domains';
import { stampAuditUpdate } from '@utils/audit';
import { openDataFlowPlayback } from '@plugins/data-flows/uiState';
import { flowsForElement, getModelDataFlows, initialOrBranchStepId } from '@utils/dataFlows';
import { isDatabaseSchemaView } from '@utils/databaseTech';
import { componentTakesDesign, containerTakesDesign } from '@utils/uiTech';
import { refreshServiceContract } from '@utils/serviceContract';
import { findComponentConnection, getTableColumns } from '@utils/schemaModel';
import type { ConnectionInfo } from '@archivisio/c4-modelizer-sdk';
import type { ConnectionData } from '@archivisio/c4-modelizer-sdk';

import type { AssistOwnerType } from '@components/common/AssistDescriptionField/AssistDescriptionField';
import type { EditingElement } from '@contexts/DialogContext';
import type { DesignSystemChoice } from '@components/common/DesignSystemField';

type FkDialogState = {
  sourceId: string;
  targetId: string;
  edgeId: string;
} | null;

type Props = {
  model: FlatC4Model;
  user: User | null;
  projectId: string | undefined;
  dialogOpen: boolean;
  isEditingContainer: boolean;
  connectionDialogOpen: boolean;
  editingConnection: ConnectionInfo | null;
  editingElement: EditingElement | null;
  fkDialog: FkDialogState;
  modelTagCatalog: string[];
  modelGroupCatalog: string[];
  relatedComponentOptions: RelatedComponentOption[];
  connectionChannelBinding?: {
    sourceIsBroker: boolean;
    targetIsBroker: boolean;
  } | null;
  onCloseEdit: () => void;
  /** Read access, or an old version: every panel opens to be read. */
  readOnly: boolean;
  onCloseConnection: () => void;
  onCloseFk: () => void;
  onUpdateSystem: (id: string, patch: Partial<SystemBlock>) => void;
  onUpdateContainer: (id: string, patch: Partial<ContainerBlock>) => void;
  onUpdateComponent: (
    id: string,
    patch: Partial<ComponentBlock> &
      Partial<TableExtras> &
      Partial<Omit<EndpointExtras, 'kind'>> &
      Partial<Omit<ChannelExtras, 'kind'>> &
      Partial<Omit<UiExtras, 'kind'>> & {
        kind?: 'endpoint' | 'channel' | 'ui';
      }
  ) => void;
  onUpdateCode: (id: string, patch: Partial<CodeBlock>) => void;
  onUpdateConnection: (
    level: FlatC4Model['viewLevel'],
    sourceId: string,
    targetId: string,
    patch: Partial<ConnectionData> | Record<string, unknown>
  ) => void;
  onSaveConnection: (info: ConnectionInfo & ConnectionExtras) => void;
};

export default function EditorEditDialogs({
  model,
  user,
  projectId,
  dialogOpen,
  isEditingContainer,
  connectionDialogOpen,
  editingConnection,
  editingElement,
  fkDialog,
  modelTagCatalog,
  modelGroupCatalog,
  relatedComponentOptions,
  connectionChannelBinding = null,
  onCloseEdit,
  readOnly,
  onCloseConnection,
  onCloseFk,
  onUpdateSystem,
  onUpdateContainer,
  onUpdateComponent,
  onUpdateCode,
  onUpdateConnection,
  onSaveConnection,
}: Props) {
  /* The assistant is offered only where an element has both a project and an
     identity — a panel opened on something unsaved has nothing to describe. */
  const assistFor = (ownerType: AssistOwnerType, ownerId: string) =>
    projectId ? { projectId, ownerType, ownerId } : null;

  const schemaMode = isDatabaseSchemaView(model);

  /* The design system an element inherits: its own if it disagrees, otherwise
     the front-end container it sits in. */
  /* Names other containers already use — a catalog by convention, like tags
     and technologies, not a table to administer. */
  const designSystemCatalog = (() => {
    /* A recorded system knows where it reads from, and that is worth showing:
       whether there is a Figma file behind a name is the thing people are
       actually choosing between. A name only some container uses has no
       source to show, which is itself the useful signal. */
    const byName = new Map<string, DesignSystemChoice>();
    for (const system of listDesignSystems(model as ModelWithDesignSystems)) {
      const name = system.name.trim();
      if (name) byName.set(name.toLowerCase(), { name, kind: system.source?.kind });
    }
    for (const container of model.containers || []) {
      const name = (container as (typeof model.containers)[number] & UiExtras).designSystem?.trim();
      if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), { name });
    }
    return [...byName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  })();

  /* Design systems / Design contracts are an account feature — guests still
     see the canvas, but not the vocabulary tooling. */
  const designToolsAllowed = true;

  /* The component's home: a design slot on something inside a database or a
     broker would never be filled. */
  const uiContainer = (() => {
    const containerId = (editingElement as { containerId?: string } | null)?.containerId;
    if (!containerId) return false;
    const container = model.containers.find((c) => c.id === containerId);
    if (!container) return false;
    return containerTakesDesign(
      container as typeof container & UiExtras,
      model.components.filter((c) => c.containerId === containerId)
    );
  })();

  const designSystemForEditingElement = (() => {
    if (!editingElement) return undefined;
    const own = (editingElement as UiExtras).designSystem;
    if (own) return own;
    const containerId = (editingElement as { containerId?: string }).containerId;
    const container = (model.containers || []).find((c) => c.id === containerId);
    return (container as (typeof model.containers)[number] & UiExtras | undefined)?.designSystem;
  })();
  const systemDomains = domainsForLevel(model, 'system');
  const containerDomains = domainsForLevel(model, 'container');

  return (
    <>
      {model.viewLevel === 'system' && editingElement && (
        <SystemEditDialog
          open={dialogOpen}
          initialName={editingElement.name}
          initialDescription={editingElement.description || ''}
          initialTechnology={(editingElement as unknown as SystemBlock).technology || ''}
          initialUrl={editingElement.url || ''}
          initialLinks={getElementLinks(editingElement)}
          initialExternal={Boolean((editingElement as unknown as SystemBlock & { external?: boolean }).external)}
          initialTags={getElementTags(editingElement)}
          availableTags={modelTagCatalog}
          initialGroup={getElementGroup(editingElement)}
          availableGroups={modelGroupCatalog}
          initialDomainId={getElementDomainId(editingElement)}
          availableDomains={systemDomains}
          audit={editingElement as AuditExtras}
          onSave={(name, description, technology, _url, links, external, tags, group, domainId) => {
            onUpdateSystem(editingElement.id, {
              name,
              description,
              technology,
              /* `url` is the element's one address, kept for everything that
                 still reads one — the linter, the clipboard, the MCP surface —
                 and it now mirrors the first link rather than being edited on
                 its own. Mirrored, not merged: falling back to the old value
                 when the list is empty meant clearing every link left the
                 address behind, and the reader folded it straight back into a
                 link. Found by clearing them. */
              url: links[0]?.url ?? '',
              links: sanitizeLinks(links),
              external,
              tags: sanitizeTags(tags),
              group: normalizeGroup(group),
              domainId: domainId || undefined,
              ...stampAuditUpdate(editingElement as AuditExtras, user),
            } as Partial<SystemBlock>);
            onCloseEdit();
          }}
          onClose={onCloseEdit}
          readOnly={readOnly}
          assist={assistFor('system', editingElement.id)}
        />
      )}

      {isEditingContainer && editingElement && (
        <ContainerEditDialog
          open={dialogOpen}
          initialName={editingElement.name}
          initialDescription={editingElement.description || ''}
          initialTechnology={(editingElement as unknown as ContainerBlock).technology || ''}
          initialUrl={editingElement.url || ''}
          initialLinks={getElementLinks(editingElement)}
          initialExternal={Boolean((editingElement as unknown as ContainerBlock & { external?: boolean }).external)}
          initialTags={getElementTags(editingElement)}
          availableTags={modelTagCatalog}
          initialGroup={getElementGroup(editingElement)}
          availableGroups={modelGroupCatalog}
          initialDomainId={getElementDomainId(editingElement)}
          availableDomains={containerDomains}
          designAvailable={false}
          initialDesignSystem={(editingElement as UiExtras).designSystem || ''}
          availableDesignSystems={designSystemCatalog}
          audit={editingElement as AuditExtras}
          flowParticipations={flowsForElement(model, editingElement.id)}
          onOpenFlowStep={(flowId, stepId) => {
            onCloseEdit();
            const flow = getModelDataFlows(model).find((item) => item.id === flowId);
            const found = flow?.steps.findIndex((s) => s.id === stepId) ?? 0;
            openDataFlowPlayback({
              flowId,
              stepIndex: found < 0 ? 0 : found,
              homeProjectId: projectId,
              flowSnapshot: flow,
              branchStepId: flow
                ? initialOrBranchStepId(flow.steps, found < 0 ? 0 : found, stepId)
                : null,
              returnView: {
                viewLevel: model.viewLevel,
                activeSystemId: model.activeSystemId,
                activeContainerId: model.activeContainerId,
                activeComponentId: model.activeComponentId,
              },
            });
          }}
          onSave={(
            name,
            description,
            technology,
            _url,
            links,
            external,
            tags,
            group,
            domainId,
            designSystem
          ) => {
            onUpdateContainer(editingElement.id, {
              name,
              description,
              technology,
              url: links[0]?.url ?? '',
              links: sanitizeLinks(links),
              external,
              tags: sanitizeTags(tags),
              group: normalizeGroup(group),
              domainId: domainId || undefined,
              designSystem: designSystem.trim() || undefined,
              ...stampAuditUpdate(editingElement as AuditExtras, user),
            } as Partial<ContainerBlock>);
            onCloseEdit();
          }}
          onClose={onCloseEdit}
          readOnly={readOnly}
          assist={assistFor('container', editingElement.id)}
        />
      )}

      {model.viewLevel === 'component' && editingElement && schemaMode && (
        <TableEditDialog
          open={dialogOpen}
          initialName={editingElement.name}
          initialColumns={getTableColumns(editingElement as TableExtras)}
          initialTags={getElementTags(editingElement)}
          availableTags={modelTagCatalog}
          initialGroup={getElementGroup(editingElement)}
          availableGroups={modelGroupCatalog}
          audit={editingElement as AuditExtras}
          onSave={(name, columns, tags, group) => {
            onUpdateComponent(editingElement.id, {
              name,
              columns,
              tags: sanitizeTags(tags),
              group: normalizeGroup(group),
              ...stampAuditUpdate(editingElement as AuditExtras, user),
            } as Partial<ComponentBlock> & TableExtras);
            onCloseEdit();
          }}
          onClose={onCloseEdit}
          readOnly={readOnly}
        />
      )}

      {model.viewLevel === 'component' &&
        editingElement &&
        !schemaMode &&
        isBrokerChannel(editingElement) && (
          <ChannelEditDialog
            open={dialogOpen}
            initialName={editingElement.name}
            initialDescription={editingElement.description || ''}
            initialProtocol={(editingElement as ChannelExtras).protocol || 'kafka'}
            initialSchemaFormat={(editingElement as ChannelExtras).schemaFormat || 'avro'}
            initialCompatibility={(editingElement as ChannelExtras).compatibility || ''}
            initialKeySchema={(editingElement as ChannelExtras).keySchema || ''}
            initialValueSchema={(editingElement as ChannelExtras).valueSchema || ''}
            initialHeadersSchema={(editingElement as ChannelExtras).headersSchema || ''}
            initialTags={getElementTags(editingElement)}
            availableTags={modelTagCatalog}
            initialGroup={getElementGroup(editingElement)}
            availableGroups={modelGroupCatalog}
            audit={editingElement as AuditExtras}
            onSave={({
              name,
              description,
              protocol,
              schemaFormat,
              compatibility,
              keySchema,
              valueSchema,
              headersSchema,
              tags,
              group,
            }) => {
              onUpdateComponent(editingElement.id, {
                name,
                description,
                kind: 'channel',
                protocol,
                schemaFormat,
                compatibility,
                keySchema,
                valueSchema,
                headersSchema,
                tags: sanitizeTags(tags),
                group: normalizeGroup(group),
                ...stampAuditUpdate(editingElement as AuditExtras, user),
              } as Partial<ComponentBlock> & ChannelExtras);
              onCloseEdit();
            }}
            onClose={onCloseEdit}
            readOnly={readOnly}
          />
        )}

      {model.viewLevel === 'component' &&
        editingElement &&
        !schemaMode &&
        isApiEndpoint(editingElement as EndpointExtras) && (
          <EndpointEditDialog
            open={dialogOpen}
            initialName={editingElement.name}
            initialDescription={editingElement.description || ''}
            initialEndpoint={(editingElement as EndpointExtras).endpoint || '/'}
            initialMethod={(editingElement as EndpointExtras).method || 'GET'}
            initialRequest={(editingElement as EndpointExtras).request || ''}
            initialResponse={(editingElement as EndpointExtras).response || ''}
            initialHeaders={(editingElement as EndpointExtras).headers || ''}
            initialTags={getElementTags(editingElement)}
            availableTags={modelTagCatalog}
            initialGroup={getElementGroup(editingElement)}
            availableGroups={modelGroupCatalog}
            audit={editingElement as AuditExtras}
            onSave={({ name, description, endpoint, method, request, response, headers, tags, group }) => {
              onUpdateComponent(editingElement.id, {
                name,
                description,
                kind: 'endpoint',
                endpoint,
                method,
                request,
                response,
                headers,
                tags: sanitizeTags(tags),
                group: normalizeGroup(group),
                ...stampAuditUpdate(editingElement as AuditExtras, user),
              } as Partial<ComponentBlock> & EndpointExtras);
              void refreshServiceContract(
                (editingElement as unknown as ComponentBlock).containerId,
                onUpdateContainer
              );
              onCloseEdit();
            }}
            onClose={onCloseEdit}
            readOnly={readOnly}
          />
        )}

      {model.viewLevel === 'component' &&
        editingElement &&
        !schemaMode &&
        !isApiEndpoint(editingElement as EndpointExtras) &&
        !isBrokerChannel(editingElement) && (
          <ComponentEditDialog
            open={dialogOpen}
            initialName={editingElement.name}
            initialDescription={editingElement.description || ''}
            initialTechnology={(editingElement as unknown as ComponentBlock).technology || ''}
            initialUrl={editingElement.url || ''}
          initialLinks={getElementLinks(editingElement)}
            initialExternal={Boolean((editingElement as unknown as ComponentBlock & { external?: boolean }).external)}
            initialTags={getElementTags(editingElement)}
            availableTags={modelTagCatalog}
            initialGroup={getElementGroup(editingElement)}
            availableGroups={modelGroupCatalog}
            audit={editingElement as AuditExtras}
            showDesign={
              designToolsAllowed &&
              /* A design that is already there is shown whatever the
                 technology says — not least so a viewer can open it and follow
                 the link. The heuristic decides where to *offer* one. */
              (Boolean((editingElement as UiExtras).design?.trim()) ||
                componentTakesDesign(
                  editingElement as { technology?: string } & UiExtras,
                  uiContainer
                ))
            }
            designElementId={editingElement.id}
            initialDesign={(editingElement as UiExtras).design || ''}
            designSystem={designSystemForEditingElement}
            onSave={(name, description, technology, _url, links, external, tags, group, design) => {
              const designText = design.trim();
              onUpdateComponent(editingElement.id, {
                name,
                description,
                technology,
                url: links[0]?.url ?? '',
                links: sanitizeLinks(links),
                external,
                tags: sanitizeTags(tags),
                group: normalizeGroup(group),
                /* Kept in step: a component that carries a design is a UI
                   element, and one that just lost its design is not. */
                design: designText,
                kind: designText ? 'ui' : undefined,
                ...stampAuditUpdate(editingElement as AuditExtras, user),
              } as Partial<ComponentBlock> &
                LinkExtras &
                Partial<Omit<UiExtras, 'kind'>> & { kind?: 'ui' });
              onCloseEdit();
            }}
            onClose={onCloseEdit}
            readOnly={readOnly}
            assist={assistFor('component', editingElement.id)}
          />
        )}

      {model.viewLevel === 'code' && editingElement && (
        <CodeEditDialog
          open={dialogOpen}
          initialName={editingElement.name}
          initialDescription={editingElement.description || ''}
          initialCodeType={
            ((editingElement as unknown as CodeBlock).codeType as
              | 'function'
              | 'class'
              | 'interface'
              | 'variable'
              | 'other') || 'class'
          }
          initialLanguage={(editingElement as unknown as CodeBlock).technology || ''}
          initialCode={(editingElement as unknown as CodeBlock).code || ''}
          initialUrl={editingElement.url || ''}
          initialLinks={getElementLinks(editingElement)}
          initialTags={getElementTags(editingElement)}
          availableTags={modelTagCatalog}
          initialGroup={getElementGroup(editingElement)}
          availableGroups={modelGroupCatalog}
          audit={editingElement as AuditExtras}
          onSave={(name, description, codeType, technology, code, _url, links, tags, group) => {
            onUpdateCode(editingElement.id, {
              name,
              description,
              codeType,
              technology,
              code,
              url: links[0]?.url ?? '',
              links: sanitizeLinks(links),
              tags: sanitizeTags(tags),
              group: normalizeGroup(group),
              ...stampAuditUpdate(editingElement as AuditExtras, user),
            } as Partial<CodeBlock>);
            onCloseEdit();
          }}
          onClose={onCloseEdit}
          readOnly={readOnly}
          assist={assistFor('code', editingElement.id)}
        />
      )}

      {connectionDialogOpen && !schemaMode && editingConnection && (
        <ConnectionEditDialog
          open={connectionDialogOpen}
          connection={editingConnection}
          relatedComponentOptions={relatedComponentOptions}
          channelBinding={connectionChannelBinding}
          onClose={onCloseConnection}
          readOnly={readOnly}
          onSave={(connectionInfo) => {
            onSaveConnection(connectionInfo);
            onCloseConnection();
          }}
        />
      )}

      {fkDialog && (
        <FkEditDialog
          open
          sourceTableName={
            model.components.find((c) => c.id === fkDialog.sourceId)?.name || 'source'
          }
          targetTableName={
            model.components.find((c) => c.id === fkDialog.targetId)?.name || 'target'
          }
          sourceColumns={getTableColumns(
            model.components.find((c) => c.id === fkDialog.sourceId) as TableExtras
          )}
          targetColumns={getTableColumns(
            model.components.find((c) => c.id === fkDialog.targetId) as TableExtras
          )}
          initialSourceColumnId={
            findComponentConnection(model, fkDialog.sourceId, fkDialog.targetId)?.foreignKey
              ?.sourceColumnId
          }
          initialTargetColumnId={
            findComponentConnection(model, fkDialog.sourceId, fkDialog.targetId)?.foreignKey
              ?.targetColumnId
          }
          onClose={onCloseFk}
          onSave={(sourceColumnId, targetColumnId) => {
            const srcCols = getTableColumns(
              model.components.find((c) => c.id === fkDialog.sourceId) as TableExtras
            );
            const tgtCols = getTableColumns(
              model.components.find((c) => c.id === fkDialog.targetId) as TableExtras
            );
            const srcName = srcCols.find((c) => c.id === sourceColumnId)?.name || 'col';
            const tgtName = tgtCols.find((c) => c.id === targetColumnId)?.name || 'col';
            onUpdateConnection('component', fkDialog.sourceId, fkDialog.targetId, {
              label: `${srcName} → ${tgtName}`,
              foreignKey: { sourceColumnId, targetColumnId },
            } as never);
            onCloseFk();
          }}
        />
      )}
    </>
  );
}

export type { FkDialogState };
