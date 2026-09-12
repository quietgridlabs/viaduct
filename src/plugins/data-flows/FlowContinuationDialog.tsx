import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { getModelDataFlows } from '@utils/dataFlows';
import type { FlowContinuationRef, StoredDataFlow } from '@/types/c4Extensions';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Button, Dialog, HStack, Input, Portal, Text, VStack } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 5;

type Props = {
  open: boolean;
  onClose: () => void;
  value: FlowContinuationRef | undefined;
  onChange: (ref: FlowContinuationRef | undefined) => void;
  currentProjectId?: string;
  /** Excluded from the list — a flow cannot continue into itself. */
  currentFlowId?: string;
};

/**
 * Community: continuation stays inside the current (local) model.
 */
export default function FlowContinuationDialog({
  open,
  onClose,
  value,
  onChange,
  currentProjectId,
  currentFlowId,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const model = useFlatC4Store((s) => s.model);

  const [pickedFlowId, setPickedFlowId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const flows: StoredDataFlow[] = useMemo(
    () => getModelDataFlows(model).filter((f) => f.id !== currentFlowId),
    [model, currentFlowId]
  );

  useEffect(() => {
    if (!open) return;
    setPickedFlowId(value?.id || null);
    setQuery('');
    setPage(0);
  }, [open, value]);

  const pickedFlow = flows.find((f) => f.id === pickedFlowId);

  const sortedFlows = useMemo(
    () =>
      [...flows].sort((a, b) =>
        (a.name || t('data_flow_new')).localeCompare(b.name || t('data_flow_new'))
      ),
    [flows, t]
  );

  const visibleFlows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedFlows;
    return sortedFlows.filter((f) =>
      (f.name || t('data_flow_new')).toLowerCase().includes(q)
    );
  }, [sortedFlows, query, t]);

  const pageCount = Math.max(1, Math.ceil(visibleFlows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageFlows = visibleFlows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const link = () => {
    if (!pickedFlow) return;
    onChange({
      id: pickedFlow.id,
      name: pickedFlow.name || t('data_flow_new'),
      projectId: currentProjectId || 'local',
      projectName: 'Local',
    });
    onClose();
  };

  const remove = () => {
    onChange(undefined);
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800} css={{ '--z-index': '1800 !important' }}>
          <Dialog.Content
            data-testid="flow-continuation-dialog"
            color="fg.default"
            minW="320px"
            maxW="480px"
            w="calc(100% - 32px)"
            {...glass.dialog}
          >
            <Dialog.Header px={DIALOG_PAD.headerPx} pt={DIALOG_PAD.headerPt} pb={DIALOG_PAD.headerPb}>
              <Dialog.Title fontWeight="600">{t('data_flow_continues_into')}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body
              px={DIALOG_PAD.bodyPx}
              py={DIALOG_PAD.bodyPy}
              display="flex"
              flexDirection="column"
              gap={DIALOG_PAD.fieldGap}
            >
              <Text fontSize="sm" color="fg.muted" lineHeight="1.55">
                {t('data_flow_continuation_hint')}
              </Text>

              {flows.length === 0 ? (
                <Box borderWidth="1px" borderColor="border.glass" borderRadius="10px">
                  <Text fontSize="sm" color="fg.muted" p="14px">
                    {t('data_flow_continuation_empty')}
                  </Text>
                </Box>
              ) : (
                <VStack align="stretch" gap="10px">
                  <Input
                    size="sm"
                    value={query}
                    data-testid="flow-continuation-search"
                    placeholder={t('data_flow_continuation_search')}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    bg="bg.dialog"
                    borderColor="border.input"
                  />

                  <Box borderWidth="1px" borderColor="border.glass" borderRadius="10px">
                    {visibleFlows.length === 0 ? (
                      <Text fontSize="sm" color="fg.muted" p="14px">
                        {t('data_flow_continuation_no_matches')}
                      </Text>
                    ) : (
                      <VStack align="stretch" gap="0">
                        {pageFlows.map((flow) => {
                          const selected = flow.id === pickedFlowId;
                          return (
                            <Box
                              key={flow.id}
                              as="button"
                              textAlign="left"
                              px="12px"
                              py="10px"
                              borderBottomWidth="1px"
                              borderColor="border.glass"
                              bg={selected ? 'bg.list.selected' : 'transparent'}
                              _hover={{ bg: selected ? 'bg.list.selected' : 'bg.list.hover' }}
                              _last={{ borderBottomWidth: 0 }}
                              onClick={() => setPickedFlowId(flow.id)}
                              data-testid={`flow-continuation-option-${flow.id}`}
                            >
                              <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                                {flow.name || t('data_flow_new')}
                              </Text>
                              <Text fontSize="xs" color="fg.muted" lineClamp={2} mt="2px">
                                {flow.description || t('data_flow_continuation_no_description')}
                              </Text>
                            </Box>
                          );
                        })}
                      </VStack>
                    )}
                  </Box>

                  {pageCount > 1 ? (
                    <HStack justify="space-between" align="center">
                      <Button
                        size="xs"
                        variant="ghost"
                        data-testid="flow-continuation-prev"
                        disabled={safePage === 0}
                        onClick={() => setPage(safePage - 1)}
                      >
                        <ChevronLeft size={14} />
                      </Button>
                      <Text fontSize="xs" color="fg.muted" data-testid="flow-continuation-page">
                        {t('data_flow_continuation_page', {
                          page: safePage + 1,
                          pages: pageCount,
                        })}
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        data-testid="flow-continuation-next"
                        disabled={safePage >= pageCount - 1}
                        onClick={() => setPage(safePage + 1)}
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </HStack>
                  ) : null}
                </VStack>
              )}
            </Dialog.Body>
            <Dialog.Footer
              gap="8px"
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              justifyContent="space-between"
            >
              {value ? (
                <Button variant="ghost" color="fg.muted" onClick={remove}>
                  {t('data_flow_continuation_clear')}
                </Button>
              ) : (
                <Box />
              )}
              <Box display="flex" gap="8px">
                <Button
                  variant="outline"
                  borderColor="border.strong"
                  color="fg.default"
                  onClick={onClose}
                >
                  {t('cancel')}
                </Button>
                <Button
                  bg="bg.neutral.emphasis"
                  color="fg.onNeutral"
                  _hover={{ bg: 'bg.neutral.emphasis.hover' }}
                  disabled={!pickedFlow}
                  onClick={link}
                  data-testid="flow-continuation-confirm"
                >
                  {t('data_flow_continuation_link')}
                </Button>
              </Box>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
