import type { ComponentBlock as ComponentBlockType, NodeData } from '@archivisio/c4-modelizer-sdk';
import C4Block from '@components/common/C4Block';
import MethodChip from '@components/common/MethodChip';
import type { DiffStatus } from '@theme/diffColors';
import DataFlowBadge from '@components/common/DataFlowBadge';
import DesignBadge from '@components/common/DesignBadge';
import DocumentationBadge from '@components/common/DocumentationBadge';
import SequenceDiagramBadge from '@components/common/SequenceDiagramBadge';
import {
  channelSurfaceLabel,
  isApiEndpoint,
  isBrokerChannel,
  type ChannelExtras,
  type DocumentationExtras,
  type EndpointExtras,
  type SequenceDiagramExtras,
  type UiExtras,
} from '@/types/c4Extensions';
import { documentationCount, listEntityDocumentations } from '@plugins/docs-editor/entityDocs';
import { useColorMode } from '@contexts/ColorModeContext';
import { useCloneJump } from '@/hooks/useCloneJump';
import { useFlatC4Store, useFlatNavigation } from '@archivisio/c4-modelizer-sdk';
import { runLevelChange } from '@/state/levelTransition';
import { useTranslation } from 'react-i18next';
import { HStack, Text } from '@chakra-ui/react';
import { Position } from '@xyflow/react';
import { memo } from 'react';
import { sameNodeCard } from '@components/common/NodeCardMemo';

type ComponentNodeData = ComponentBlockType &
  EndpointExtras &
  ChannelExtras &
  UiExtras &
  SequenceDiagramExtras &
  DocumentationExtras & {
    onEdit: () => void;
    traceHighlight?: boolean;
    traceDimmed?: boolean;
    traceContainerLabel?: string;
  };

const ComponentBlock: React.FC<NodeData<ComponentBlockType>> = memo(({ data, selected }) => {
  const { c4Colors, chrome } = useColorMode();
  const { t } = useTranslation();
  const { navigateToCode } = useFlatNavigation();
  const activeSystemId = useFlatC4Store((s) => s.model.activeSystemId);
  const activeContainerId = useFlatC4Store((s) => s.model.activeContainerId);
  const nodeData = data as ComponentNodeData;
  const ownerId = nodeData.original?.id || nodeData.id;
  const endpoint = isApiEndpoint(nodeData);
  const channel = isBrokerChannel(nodeData);
  const diagrams = nodeData.sequenceDiagrams ?? [];
  /* Inherited from the front end it sits in, unless this element disagrees. */
  const designSystem = useFlatC4Store((state) => {
    if (nodeData.designSystem) return nodeData.designSystem;
    const container = state.model.containers.find((c) => c.id === nodeData.containerId);
    return (container as typeof container & UiExtras | undefined)?.designSystem;
  });
  const colors = c4Colors.component;
  const jumpToOriginal = useCloneJump(nodeData);

  return (
    <C4Block
      item={data}
      onEdit={data.onEdit}
      colors={colors}
      kindLabel={t('catalog_kind_component')}
      onJumpToOriginal={jumpToOriginal}
      onDrillDown={
        // Endpoints and channels open their editor instead of a deeper level.
        !endpoint && !channel && activeSystemId && activeContainerId
          ? () => runLevelChange(() => navigateToCode(activeSystemId, activeContainerId, nodeData.id))
          : undefined
      }
      selected={selected}
      traceHighlight={nodeData.traceHighlight}
      traceDimmed={nodeData.traceDimmed}
      linkedHighlight={Boolean((nodeData as { linkedHighlight?: boolean }).linkedHighlight)}
      diffStatus={(nodeData as { diffStatus?: DiffStatus }).diffStatus}
      traceContainerLabel={nodeData.traceContainerLabel}
      handlePositions={{
        source: [Position.Right, Position.Bottom, Position.Left, Position.Top],
        target: [Position.Left, Position.Top, Position.Bottom, Position.Right],
      }}
      actionsBeforeEdit={
        <>
          <DocumentationBadge
            ownerType="component"
            ownerId={ownerId}
            ownerName={nodeData.name}
            documentationCount={documentationCount(nodeData)}
            documentationId={nodeData.documentationId}
            documentations={listEntityDocumentations(nodeData)}
          />
          <SequenceDiagramBadge
            ownerType="component"
            ownerId={ownerId}
            ownerName={nodeData.name}
            diagrams={diagrams}
          />
          <DataFlowBadge
            ownerType="component"
            ownerId={ownerId}
            ownerName={nodeData.name}
          />
          <DesignBadge
            design={nodeData.design}
            designSystem={designSystem}
            onEdit={nodeData.onEdit}
          />
        </>
      }
    >
      {endpoint && (
        <HStack gap="6px" mt="4px" minW={0}>
          <MethodChip method={nodeData.method || 'GET'} />
          <Text
            fontSize="xs"
            color={chrome.nodeTextMuted ?? chrome.textSecondary}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            title={nodeData.endpoint || '/'}
          >
            {nodeData.endpoint || '/'}
          </Text>
        </HStack>
      )}
      {channel && (
        <HStack gap="6px" mt="4px" minW={0}>
          <MethodChip method={nodeData.protocol || 'kafka'} />
          <Text
            fontSize="xs"
            color={chrome.nodeTextMuted ?? chrome.textSecondary}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            title={nodeData.name}
          >
            {channelSurfaceLabel(nodeData.protocol)}
          </Text>
        </HStack>
      )}
    </C4Block>
  );
}, sameNodeCard);

export default ComponentBlock;
