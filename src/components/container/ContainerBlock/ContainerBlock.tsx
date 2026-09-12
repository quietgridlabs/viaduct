import type { ContainerBlock as ContainerBlockType, NodeData } from '@archivisio/c4-modelizer-sdk';
import C4Block from '@components/common/C4Block';
import type { DiffStatus } from '@theme/diffColors';
import DataFlowBadge from '@components/common/DataFlowBadge';
import DocumentationBadge from '@components/common/DocumentationBadge';
import SequenceDiagramBadge from '@components/common/SequenceDiagramBadge';
import ChannelContractBadge from '@components/common/ChannelContractBadge';
import ServiceContractBadge from '@components/common/ServiceContractBadge';
import { channelCountForCard } from '@utils/channelCatalog';
import { serviceContractOwnerForCard } from '@utils/serviceContract';
import type {
  DocumentationExtras,
  SequenceDiagramExtras,
  ServiceContractExtras,
} from '@/types/c4Extensions';
import { documentationCount, listEntityDocumentations } from '@plugins/docs-editor/entityDocs';
import { useColorMode } from '@contexts/ColorModeContext';
import { useFlatC4Store, useFlatNavigation } from '@archivisio/c4-modelizer-sdk';
import { useCloneJump } from '@/hooks/useCloneJump';
import { runLevelChange } from '@/state/levelTransition';
import { useTranslation } from 'react-i18next';
import { Position } from '@xyflow/react';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { sameNodeCard } from '@components/common/NodeCardMemo';

type ContainerNodeData = ContainerBlockType &
  SequenceDiagramExtras &
  DocumentationExtras &
  ServiceContractExtras & {
    onEdit?: () => void;
    traceHighlight?: boolean;
    traceDimmed?: boolean;
  };

const ContainerBlock: React.FC<NodeData<ContainerBlockType>> = memo(
  ({ data, selected }) => {
    const { c4Colors } = useColorMode();
    const { t } = useTranslation();
    const { navigateToComponent } = useFlatNavigation();
    const activeSystemId = useFlatC4Store((s) => s.model.activeSystemId);
    const nodeData = data as ContainerNodeData;
    const ownerId = nodeData.original?.id || nodeData.id;
    const docsOwnerType =
      nodeData.original?.type === 'system' ||
      nodeData.original?.type === 'container' ||
      nodeData.original?.type === 'component' ||
      nodeData.original?.type === 'code'
        ? nodeData.original.type
        : 'container';
    const documentations = listEntityDocumentations(nodeData);
    const diagrams = nodeData.sequenceDiagrams ?? [];
    const seqOwnerType =
      nodeData.original?.type === 'component' ? 'component' : 'container';
    const colors = c4Colors.container;
    const jumpToOriginal = useCloneJump(nodeData as ContainerNodeData & { domainId?: string });
    /* Always return the same shape so useShallow can stabilize getSnapshot —
       a fresh object/`null` from the selector trips React #185. */
    const contractOwner = useFlatC4Store(
      useShallow((s) => {
        const owner = serviceContractOwnerForCard(s.model, ownerId, {
          originalType: nodeData.original?.type,
          openapi: nodeData.openapi,
        });
        return {
          containerId: owner?.containerId ?? '',
          count: owner?.count ?? 0,
          openapi: owner?.openapi,
        };
      })
    );
    const channelOwner = useFlatC4Store(
      useShallow((s) => {
        const owner = channelCountForCard(s.model, ownerId, {
          originalType: nodeData.original?.type,
          originalId: nodeData.original?.id,
        });
        return {
          containerId: owner?.containerId ?? '',
          count: owner?.count ?? 0,
        };
      })
    );

    return (
      <C4Block
        item={data}
        onEdit={data.onEdit}
        colors={colors}
        handlePositions={{
          source: [
            Position.Right,
            Position.Bottom,
            Position.Left,
            Position.Top,
          ],
          target: [
            Position.Left,
            Position.Top,
            Position.Bottom,
            Position.Right,
          ],
        }}
        selected={selected}
        traceHighlight={nodeData.traceHighlight}
        traceDimmed={nodeData.traceDimmed}
        linkedHighlight={Boolean((nodeData as { linkedHighlight?: boolean }).linkedHighlight)}
        diffStatus={(nodeData as { diffStatus?: DiffStatus }).diffStatus}
        kindLabel={t('catalog_kind_container')}
        onDrillDown={
          activeSystemId
            ? () => runLevelChange(() => navigateToComponent(activeSystemId, nodeData.id))
            : undefined
        }
        onJumpToOriginal={jumpToOriginal}
        actionsBeforeEdit={
          <>
            {contractOwner.count > 0 ? (
              <ServiceContractBadge
                containerId={contractOwner.containerId}
                containerName={nodeData.name}
                endpointCount={contractOwner.count}
                openapi={contractOwner.openapi}
              />
            ) : null}
            {channelOwner.count > 0 ? (
              <ChannelContractBadge
                containerId={channelOwner.containerId || nodeData.id}
                containerName={nodeData.name}
                count={channelOwner.count}
              />
            ) : null}
            <DocumentationBadge
              ownerType={docsOwnerType}
              ownerId={ownerId}
              ownerName={nodeData.name}
              documentationCount={documentationCount(nodeData)}
              documentationId={nodeData.documentationId}
              documentations={documentations}
            />
            <SequenceDiagramBadge
              ownerType={seqOwnerType}
              ownerId={ownerId}
              ownerName={nodeData.name}
              diagrams={diagrams}
            />
            <DataFlowBadge
              ownerType="container"
              ownerId={ownerId}
              ownerName={nodeData.name}
            />
          </>
        }
      />
    );
  },
  sameNodeCard
);

export default ContainerBlock;
