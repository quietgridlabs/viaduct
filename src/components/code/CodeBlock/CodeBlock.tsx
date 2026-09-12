import { ColorStyle } from '@theme/theme';
import type { CodeBlock as CodeBlockType, NodeData } from '@archivisio/c4-modelizer-sdk';
import C4Block from '@components/common/C4Block';
import type { DiffStatus } from '@theme/diffColors';
import DataFlowBadge from '@components/common/DataFlowBadge';
import DocumentationBadge from '@components/common/DocumentationBadge';
import type { DocumentationExtras } from '@/types/c4Extensions';
import { documentationCount, listEntityDocumentations } from '@plugins/docs-editor/entityDocs';
import { useColorMode } from '@contexts/ColorModeContext';
import { useCloneJump } from '@/hooks/useCloneJump';
import { useTranslation } from 'react-i18next';
import { Badge, Box } from '@chakra-ui/react';
import { Position } from '@xyflow/react';
import { memo } from 'react';
import { sameNodeCard } from '@components/common/NodeCardMemo';

const CodeBlock: React.FC<NodeData<CodeBlockType>> = memo(
  ({ data, selected }) => {
    const typedData = data as CodeBlockType & {
      documentationId?: string;
      onEdit?: () => void;
      traceHighlight?: boolean;
      traceDimmed?: boolean;
    } & DocumentationExtras;
    const ownerId = typedData.original?.id || typedData.id;
    const { c4Colors, chrome } = useColorMode();
    const { t } = useTranslation();
    const jumpToOriginal = useCloneJump(typedData);

    const getCodeColors = (): ColorStyle => {
      switch (typedData.codeType) {
        case 'class':
          return c4Colors.code;
        case 'function':
          return c4Colors.system;
        case 'interface':
          return c4Colors.container;
        case 'variable':
          return c4Colors.component;
        default:
          return c4Colors.code;
      }
    };

    const getChipBorderColor = () => {
      switch (typedData.codeType) {
        case 'class':
          return '#ab47bc';
        case 'function':
          return '#26a69a';
        case 'interface':
          return '#ffa726';
        case 'variable':
          return '#42a5f5';
        default:
          return '#ab47bc';
      }
    };

    const colors = getCodeColors();

    return (
      <C4Block
        item={typedData}
        kindLabel={t('code')}
        onJumpToOriginal={jumpToOriginal}
        onEdit={typedData.onEdit || (() => undefined)}
        colors={colors}
        selected={selected}
        traceHighlight={typedData.traceHighlight}
        traceDimmed={typedData.traceDimmed}
      linkedHighlight={Boolean((typedData as { linkedHighlight?: boolean }).linkedHighlight)}
      diffStatus={(typedData as { diffStatus?: DiffStatus }).diffStatus}
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
        actionsBeforeEdit={
          <>
            <DocumentationBadge
              ownerType="code"
              ownerId={ownerId}
              ownerName={typedData.name}
              documentationCount={documentationCount(typedData)}
              documentationId={typedData.documentationId}
              documentations={listEntityDocumentations(typedData)}
            />
            <DataFlowBadge
              ownerType="code"
              ownerId={ownerId}
              ownerName={typedData.name}
            />
          </>
        }
      >
        <Box>
          <Badge
            variant="outline"
            borderColor={getChipBorderColor()}
            color={chrome.nodeText}
            fontWeight="500"
            bg={chrome.nodeInsetBg}
            px="12px"
            position="absolute"
            top="35px"
            right="10px"
          >
            {typedData.codeType}
          </Badge>
        </Box>
      </C4Block>
    );
  },
  sameNodeCard
);

export default CodeBlock;
