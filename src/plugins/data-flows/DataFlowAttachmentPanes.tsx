import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import PanelCollapseRail, { PanelCollapseStack } from '@components/common/PanelCollapseRail';
import SidePanelShell, { PanelEmptyState } from '@components/common/SidePanelShell';
import ThemedSelect from '@components/common/ThemedSelect';
import { ToolbarIconButton } from '@components/common/ToolbarIconButton';
import type { StoredDataFlow } from '@/types/c4Extensions';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { collectEndpointIndex } from '@plugins/docs-editor/endpointRefs';
import DocumentationPreview from '@plugins/docs-editor/DocumentationPreview';
import SequenceDiagramEmbed from '@plugins/docs-editor/SequenceDiagramEmbed';
import { usePaneRoom, useRubberOpen } from '@hooks/useRubberPane';
import { SIDE_PANEL_INSET } from '@theme/sidePanelLayout';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listProjectDocs,
  listProjectSequences,
  resolveFlowDocs,
  resolveFlowSequences,
} from './attachments';

/** Shared floor for the steps editor and the properties pane. */
export const DATA_FLOW_PANE_MIN_WIDTH = '480px';

type Props = {
  model: FlatC4Model;
  flow: StoredDataFlow;
  canWrite: boolean;
  onChange: (
    patch: Pick<
      StoredDataFlow,
      'documentationIds' | 'sequenceIds' | 'magicSequenceId' | 'magicSequenceSourceKey'
    >
  ) => void;
  onMakeMagicSequence?: () => void | Promise<void>;
  magicSequenceBusy?: boolean;
  magicSequenceStale?: boolean;
  magicSequenceDisabled?: boolean;
  properties?: ReactNode;
  selectedStepId?: string | null;
};

export default function DataFlowAttachmentPanes({
  model,
  flow,
  canWrite,
  onChange,
  onMakeMagicSequence,
  magicSequenceBusy = false,
  magicSequenceStale = false,
  magicSequenceDisabled = false,
  properties,
  selectedStepId,
}: Props) {
  const { t } = useTranslation();
  const room = usePaneRoom();
  const [propsOpen, setPropsOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);
  const [seqOpen, setSeqOpen] = useRubberOpen(room.tertiary);
  const [docPick, setDocPick] = useState('');
  const [seqPick, setSeqPick] = useState('');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeSeqId, setActiveSeqId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedStepId) setPropsOpen(true);
  }, [selectedStepId]);

  const allDocs = useMemo(() => listProjectDocs(model), [model]);
  const allSequences = useMemo(() => listProjectSequences(model), [model]);
  const attachedDocs = useMemo(
    () => resolveFlowDocs(model, flow.documentationIds),
    [model, flow.documentationIds]
  );
  const attachedSequences = useMemo(
    () => resolveFlowSequences(model, flow.sequenceIds),
    [model, flow.sequenceIds]
  );

  useEffect(() => {
    setActiveDocId((current) => {
      if (current && attachedDocs.some((d) => d.id === current)) return current;
      return attachedDocs[0]?.id ?? null;
    });
  }, [flow.id, attachedDocs]);

  useEffect(() => {
    setActiveSeqId((current) => {
      if (current && attachedSequences.some((d) => d.id === current)) return current;
      return attachedSequences[0]?.id ?? null;
    });
  }, [flow.id, attachedSequences]);

  const endpointIndex = useMemo(() => collectEndpointIndex(model), [model]);
  const sequenceIndex = useMemo(
    () => new Map(allSequences.map((d) => [d.id, d])),
    [allSequences]
  );

  const availableDocs = allDocs.filter(
    (d) => !(flow.documentationIds || []).includes(d.id)
  );
  const availableSequences = allSequences.filter(
    (d) => !(flow.sequenceIds || []).includes(d.id)
  );

  const activeDoc = attachedDocs.find((d) => d.id === activeDocId) ?? null;
  const activeSeq = attachedSequences.find((d) => d.id === activeSeqId) ?? null;

  const attachDoc = () => {
    if (!canWrite || !docPick) return;
    onChange({
      documentationIds: [...(flow.documentationIds || []), docPick],
      sequenceIds: flow.sequenceIds || [],
    });
    setActiveDocId(docPick);
    setDocPick('');
  };

  const attachSeq = () => {
    if (!canWrite || !seqPick) return;
    onChange({
      documentationIds: flow.documentationIds || [],
      sequenceIds: [...(flow.sequenceIds || []), seqPick],
    });
    setActiveSeqId(seqPick);
    setSeqPick('');
  };

  const detachDoc = (id: string) => {
    if (!canWrite) return;
    onChange({
      documentationIds: (flow.documentationIds || []).filter((item) => item !== id),
      sequenceIds: flow.sequenceIds || [],
    });
  };

  const detachSeq = (id: string) => {
    if (!canWrite) return;
    onChange({
      documentationIds: flow.documentationIds || [],
      sequenceIds: (flow.sequenceIds || []).filter((item) => item !== id),
    });
  };

  return (
    <HStack
      display={{ base: 'none', md: 'flex' }}
      flex={docsOpen && seqOpen ? '3 1 0%' : docsOpen || seqOpen ? '2 1 0%' : '0 0 auto'}
      minW={docsOpen && seqOpen ? '520px' : docsOpen || seqOpen ? '320px' : undefined}
      minH={0}
      h="full"
      align="stretch"
      gap={SIDE_PANEL_INSET}
    >
      {propsOpen && properties ? (
        <SidePanelShell
          embedded
          overlay={false}
          width={DATA_FLOW_PANE_MIN_WIDTH}
          title={t('data_flow_panel_properties')}
          collapseDirection="right"
          closeLabel={t('data_flow_hide_properties')}
          onClose={() => setPropsOpen(false)}
        >
          {properties}
        </SidePanelShell>
      ) : null}

      {docsOpen ? (
        <SidePanelShell
          embedded
          overlay={false}
          width="full"
          title={t('data_flow_panel_docs')}
          subtitle={t('data_flow_attachments_count', { count: attachedDocs.length })}
          collapseDirection="right"
          closeLabel={t('data_flow_hide_docs')}
          onClose={() => setDocsOpen(false)}
          headerMeta={
            canWrite ? (
              <HStack gap="8px" align="flex-end">
                <ThemedSelect
                  size="sm"
                  flex="1"
                  mb={0}
                  value={docPick}
                  onChange={setDocPick}
                  disabled={!availableDocs.length}
                  placeholder={
                    availableDocs.length
                      ? t('data_flow_pick_doc')
                      : t('data_flow_no_docs')
                  }
                  options={[
                    { value: '', label: t('data_flow_pick_doc') },
                    ...availableDocs.map((d) => ({ value: d.id, label: d.label })),
                  ]}
                />
                <Button
                  size="sm"
                  variant="outline"
                  flexShrink={0}
                  disabled={!docPick}
                  onClick={attachDoc}
                >
                  <Plus size={12} />
                  {t('data_flow_attach')}
                </Button>
              </HStack>
            ) : undefined
          }
        >
          {attachedDocs.length === 0 ? (
            <PanelEmptyState>{t('data_flow_attachments_empty_docs')}</PanelEmptyState>
          ) : (
            <>
              <VStack align="stretch" gap="0" flexShrink={0} maxH="28%">
                {attachedDocs.map((doc) => (
                  <HStack
                    key={doc.id}
                    px="14px"
                    py="8px"
                    gap="8px"
                    borderBottomWidth="1px"
                    borderColor="border.glass"
                    bg={doc.id === activeDocId ? 'bg.list.selected' : 'transparent'}
                    cursor="pointer"
                    _hover={{ bg: doc.id === activeDocId ? 'bg.list.selected' : 'bg.list.hover' }}
                    onClick={() => setActiveDocId(doc.id)}
                  >
                    <Box flex="1" minW={0}>
                      <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                        {doc.title}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                        {doc.ownerName}
                      </Text>
                    </Box>
                    {canWrite ? (
                      <ToolbarIconButton
                        aria-label={t('data_flow_detach')}
                        title={t('data_flow_detach')}
                        onClick={(e) => {
                          e.stopPropagation();
                          detachDoc(doc.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </ToolbarIconButton>
                    ) : null}
                  </HStack>
                ))}
              </VStack>
              <Box flex="1" minH={0} overflowY="auto" p="16px">
                {activeDoc ? (
                  <DocumentationPreview
                    markdown={activeDoc.markdown}
                    resolveSequence={(id) => {
                      const hit = sequenceIndex.get(id);
                      if (!hit) return null;
                      return {
                        id: hit.id,
                        name: hit.name,
                        plantUmlSource: hit.plantUmlSource,
                        ownerType: hit.ownerType,
                        ownerId: hit.ownerId,
                      };
                    }}
                    resolveEndpoint={(id) => endpointIndex.get(id) ?? null}
                    readOnly
                  />
                ) : null}
              </Box>
            </>
          )}
        </SidePanelShell>
      ) : null}

      {seqOpen ? (
        <SidePanelShell
          embedded
          overlay={false}
          width="full"
          title={t('data_flow_panel_sequences')}
          subtitle={t('data_flow_attachments_count', { count: attachedSequences.length })}
          collapseDirection="right"
          closeLabel={t('data_flow_hide_sequences')}
          onClose={() => setSeqOpen(false)}
          headerMeta={
            canWrite ? (
              <VStack align="stretch" gap="8px">
                <HStack gap="8px" align="flex-end">
                  <ThemedSelect
                    size="sm"
                    flex="1"
                    mb={0}
                    value={seqPick}
                    onChange={setSeqPick}
                    disabled={!availableSequences.length}
                    placeholder={
                      availableSequences.length
                        ? t('data_flow_pick_sequence')
                        : t('data_flow_no_sequences')
                    }
                    options={[
                      { value: '', label: t('data_flow_pick_sequence') },
                      ...availableSequences.map((d) => ({ value: d.id, label: d.label })),
                    ]}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    flexShrink={0}
                    disabled={!seqPick}
                    onClick={attachSeq}
                  >
                    <Plus size={12} />
                    {t('data_flow_attach')}
                  </Button>
                </HStack>
                <Button
                  size="sm"
                  variant="outline"
                  alignSelf="stretch"
                  disabled={magicSequenceBusy || magicSequenceDisabled || !onMakeMagicSequence}
                  loading={magicSequenceBusy}
                  spinner={<QuackSpinner size="sm" color="currentColor" />}
                  onClick={() => void onMakeMagicSequence?.()}
                >
                  <Sparkles size={12} />
                  {magicSequenceStale
                    ? t('data_flow_regenerate_magic_sequence')
                    : t('data_flow_make_magic_sequence')}
                </Button>
              </VStack>
            ) : undefined
          }
        >
          {attachedSequences.length === 0 ? (
            <PanelEmptyState>{t('data_flow_attachments_empty_sequences')}</PanelEmptyState>
          ) : (
            <>
              <VStack align="stretch" gap="0" flexShrink={0} maxH="28%">
                {attachedSequences.map((seq) => (
                  <HStack
                    key={seq.id}
                    px="14px"
                    py="8px"
                    gap="8px"
                    borderBottomWidth="1px"
                    borderColor="border.glass"
                    bg={seq.id === activeSeqId ? 'bg.list.selected' : 'transparent'}
                    cursor="pointer"
                    _hover={{ bg: seq.id === activeSeqId ? 'bg.list.selected' : 'bg.list.hover' }}
                    onClick={() => setActiveSeqId(seq.id)}
                  >
                    <Box flex="1" minW={0}>
                      <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                        {seq.name}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                        {seq.ownerName}
                      </Text>
                    </Box>
                    {canWrite ? (
                      <ToolbarIconButton
                        aria-label={t('data_flow_detach')}
                        title={t('data_flow_detach')}
                        onClick={(e) => {
                          e.stopPropagation();
                          detachSeq(seq.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </ToolbarIconButton>
                    ) : null}
                  </HStack>
                ))}
              </VStack>
              <Box flex="1" minH={0} overflowY="auto" p="10px">
                {activeSeq ? (
                  <SequenceDiagramEmbed
                    name={activeSeq.name}
                    plantUmlSource={activeSeq.plantUmlSource}
                  />
                ) : null}
              </Box>
            </>
          )}
        </SidePanelShell>
      ) : null}

      {!propsOpen || !docsOpen || !seqOpen ? (
        <PanelCollapseStack side="right">
          {properties && !propsOpen ? (
            <PanelCollapseRail
              stacked
              side="right"
              label={t('data_flow_panel_properties')}
              title={t('data_flow_show_properties')}
              onExpand={() => setPropsOpen(true)}
            />
          ) : null}
          {!docsOpen ? (
            <PanelCollapseRail
              stacked
              side="right"
              label={t('data_flow_panel_docs')}
              title={t('data_flow_show_docs')}
              onExpand={() => setDocsOpen(true)}
            />
          ) : null}
          {!seqOpen ? (
            <PanelCollapseRail
              stacked
              side="right"
              label={t('data_flow_panel_sequences')}
              title={t('data_flow_show_sequences')}
              onExpand={() => setSeqOpen(true)}
            />
          ) : null}
        </PanelCollapseStack>
      ) : null}
    </HStack>
  );
}
