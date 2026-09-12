import { Highlighter } from 'lucide-react';
import { Panel } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useColorMode } from '@contexts/ColorModeContext';
import { useConnectionTrace } from '@contexts/ConnectionTraceContext';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { Button, Portal, Tooltip } from '@chakra-ui/react';

export default function ClearConnectionTracePanel() {
  const { t } = useTranslation();
  const { mode, chrome } = useColorMode();
  const { trace, clearHighlight } = useConnectionTrace();
  const viewLevel = useFlatC4Store((s) => s.model.viewLevel);
  const activeContainerId = useFlatC4Store((s) => s.model.activeContainerId);
  const activeExplore =
    Boolean(trace?.highlightedIds.length) &&
    viewLevel === 'component' &&
    activeContainerId === trace?.focusContainerId;
  if (!activeExplore) return null;

  const label = t('clear_connection_highlight');

  return (
    <Panel position="top-right" style={{ marginTop: 12, marginRight: 12 }}>
      <Tooltip.Root openDelay={350} closeDelay={80} positioning={{ placement: 'top' }}>
        <Tooltip.Trigger asChild>
          <Button
            data-testid="canvas-clear-connection-trace"
            size="sm"
            onClick={clearHighlight}
            aria-label={label}
            fontWeight={600}
            borderRadius="md"
            bg={chrome.brand}
            color="#fff"
            gap="6px"
            boxShadow={
              mode === 'light'
                ? '0 4px 14px rgba(15, 39, 68, 0.16)'
                : '0 4px 14px rgba(0, 0, 0, 0.45)'
            }
            _hover={{ bg: chrome.brand, filter: 'brightness(1.08)' }}
          >
            <Highlighter size={16} />
            {label}
          </Button>
        </Tooltip.Trigger>
        <Portal>
          <Tooltip.Positioner>
            <Tooltip.Content
              bg="bg.dialog"
              color="fg.default"
              borderWidth="1px"
              borderColor="border.default"
              px="8px"
              py="4px"
              fontSize="xs"
              borderRadius="md"
              boxShadow="float"
            >
              {label}
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Portal>
      </Tooltip.Root>
    </Panel>
  );
}
