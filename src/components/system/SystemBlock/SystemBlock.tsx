import type { NodeData, SystemBlock as SystemBlockType } from '@archivisio/c4-modelizer-sdk';
import C4Block from '@components/common/C4Block';
import type { DiffStatus } from '@theme/diffColors';
import DataFlowBadge from '@components/common/DataFlowBadge';
import DocumentationBadge from '@components/common/DocumentationBadge';
import type { DocumentationExtras } from '@/types/c4Extensions';
import { documentationCount, listEntityDocumentations } from '@plugins/docs-editor/entityDocs';
import { useColorMode } from '@contexts/ColorModeContext';
import { useFlatNavigation } from '@archivisio/c4-modelizer-sdk';
import { useCloneJump } from '@/hooks/useCloneJump';
import { runLevelChange } from '@/state/levelTransition';
import { useTranslation } from 'react-i18next';
import { Position } from '@xyflow/react';
import { memo } from 'react';
import { sameNodeCard } from '@components/common/NodeCardMemo';

type SystemNodeData = SystemBlockType & {
  documentationId?: string;
  onEdit?: () => void;
  traceHighlight?: boolean;
  traceDimmed?: boolean;
} & DocumentationExtras;

function SystemBlock({
  data,
  selected,
}: NodeData<SystemBlockType>) {
  const { c4Colors } = useColorMode();
  const { t } = useTranslation();
  const { navigateToContainer } = useFlatNavigation();
  const nodeData = data as SystemNodeData;
  const ownerId = nodeData.original?.id || nodeData.id;
  const colors = c4Colors.system;
  const jumpToOriginal = useCloneJump(nodeData as SystemNodeData & { domainId?: string });
  return (
    <C4Block
      item={data}
      onEdit={data.onEdit}
      colors={colors}
      selected={selected}
      traceHighlight={nodeData.traceHighlight}
      traceDimmed={nodeData.traceDimmed}
      linkedHighlight={Boolean((nodeData as { linkedHighlight?: boolean }).linkedHighlight)}
      diffStatus={(nodeData as { diffStatus?: DiffStatus }).diffStatus}
      kindLabel={t('catalog_kind_system')}
      onDrillDown={() => runLevelChange(() => navigateToContainer(nodeData.id))}
      onJumpToOriginal={jumpToOriginal}
      handlePositions={{
        source: [Position.Right, Position.Bottom, Position.Left, Position.Top],
        target: [Position.Left, Position.Top, Position.Bottom, Position.Right],
      }}
      actionsBeforeEdit={
        <>
          <DocumentationBadge
            ownerType="system"
            ownerId={ownerId}
            ownerName={nodeData.name}
            documentationCount={documentationCount(nodeData)}
            documentationId={nodeData.documentationId}
            documentations={listEntityDocumentations(nodeData)}
          />
          <DataFlowBadge
            ownerType="system"
            ownerId={ownerId}
            ownerName={nodeData.name}
          />
        </>
      }
    />
  );
}

export default memo(SystemBlock, sameNodeCard);
