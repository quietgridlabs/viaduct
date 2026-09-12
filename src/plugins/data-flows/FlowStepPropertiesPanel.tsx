import SearchableSelect, {
  type SearchableSelectOption,
} from '@components/common/SearchableSelect';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { PanelFieldset, panelFlushFieldCss } from '@components/common/PanelForm';
import FlowParticipantPickerDialog, {
  FlowParticipantSummary,
} from './FlowParticipantPickerDialog';
import ThemedTextField from '@components/common/ThemedTextField';
import type { DataFlowStep, FlowBranchKind, FlowContinuationRef } from '@/types/c4Extensions';
import type { FlowParticipantRef } from '@/types/c4Extensions';
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type EndpointOption = { id: string; label: string; detail?: string; group?: string };
type ConnectionOption = {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  label?: string;
};

type Props = {
  step: DataFlowStep | null;
  branched?: boolean;
  branchKind?: FlowBranchKind;
  canWrite?: boolean;
  currentProjectId?: string;
  participantOptions: {
    value: string;
    label: string;
    detail?: string;
    group?: string;
  }[];
  endpointOptions: EndpointOption[];
  channelOptions?: EndpointOption[];
  connectionOptions: ConnectionOption[];
  onPatch: (stepId: string, patch: Partial<DataFlowStep>) => void;
  /** Opens the flow picker for a link step's target. */
  onEditContinuation?: () => void;
};

function FlowStepPropertiesPanel({
  step,
  branched,
  branchKind = 'parallel',
  canWrite,
  currentProjectId,
  participantOptions,
  endpointOptions,
  channelOptions = [],
  connectionOptions,
  onPatch,
  onEditContinuation,
}: Props) {
  const { t } = useTranslation();
  const [endpointPick, setEndpointPick] = useState('');
  const [channelPick, setChannelPick] = useState('');
  const [connectionPick, setConnectionPick] = useState('');
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  const stepId = step?.id ?? '';

  useEffect(() => {
    setPicking(null);
  }, [stepId]);

  const handleFromChange = useCallback((ref: FlowParticipantRef) => {
    onPatchRef.current(stepId, { from: ref });
  }, [stepId]);

  const handleToChange = useCallback((ref: FlowParticipantRef) => {
    onPatchRef.current(stepId, { to: ref });
  }, [stepId]);

  const endpointSelectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      endpointOptions.map((opt) => ({
        value: opt.id,
        label: opt.label,
        detail: opt.detail,
        group: opt.group,
      })),
    [endpointOptions]
  );
  const channelSelectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      channelOptions.map((opt) => ({
        value: opt.id,
        label: opt.label,
        detail: opt.detail,
        group: opt.group,
      })),
    [channelOptions]
  );

  const connectionSelectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      connectionOptions.map((opt) => ({
        value: `${opt.sourceId}->${opt.targetId}`,
        label: opt.label
          ? `${opt.label} · ${opt.sourceName} → ${opt.targetName}`
          : `${opt.sourceName} → ${opt.targetName}`,
      })),
    [connectionOptions]
  );

  if (!step) {
    return (
      <Box flex="1" minH={0} p="12px">
        <Text fontSize="sm" color="fg.muted">
          {t('data_flow_properties_empty')}
        </Text>
      </Box>
    );
  }

  const isLink = step.kind === 'link';
  const target: FlowContinuationRef | undefined = step.nextFlowRef;

  const selectedEndpointIds = new Set(step.endpointIds || []);
  const selectedChannelIds = new Set(step.channelIds || []);
  const selectedConnectionKeys = new Set(
    (step.connections || []).map((c) => `${c.sourceId}->${c.targetId}`)
  );
  const availableEndpointOptions = endpointSelectOptions.filter(
    (opt) => !selectedEndpointIds.has(opt.value)
  );
  const availableChannelOptions = channelSelectOptions.filter(
    (opt) => !selectedChannelIds.has(opt.value)
  );
  const availableConnectionOptions = connectionSelectOptions.filter(
    (opt) => !selectedConnectionKeys.has(opt.value)
  );

  const pickingValue = picking === 'to' ? step.to : step.from;
  const pickingTitle = picking === 'to' ? t('data_flow_to') : t('data_flow_from');

  return (
    <VStack
      align="stretch"
      gap={DIALOG_PAD.fieldGap}
      p="12px"
      flex="1"
      minH={0}
      overflowY="auto"
      css={panelFlushFieldCss}
    >
      {branched ? (
        <Text fontSize="xs" color="fg.muted">
          {t(
            branchKind === 'alternative'
              ? 'data_flow_alternative_hint'
              : 'data_flow_parallel_hint'
          )}
        </Text>
      ) : null}
      <PanelFieldset readOnly={!canWrite}>
        <ThemedTextField
          label={t('data_flow_step_name')}
          value={isLink ? target?.name || '' : step.name}
          onChange={(e) => onPatch(step.id, { name: e.target.value })}
          disabled={!canWrite || isLink}
          fullWidth
          size="small"
        />
        <ThemedTextField
          label={t('data_flow_step_description')}
          value={step.description || ''}
          onChange={(e) => onPatch(step.id, { description: e.target.value })}
          disabled={!canWrite}
          fullWidth
          multiline
          minRows={3}
          size="small"
        />
        {isLink ? (
          <VStack align="stretch" gap="8px">
            <Text fontSize="xs" color="fg.muted">
              {t('data_flow_continues_into')}
            </Text>
            {target ? (
              <HStack
                px="10px"
                py="8px"
                borderWidth="1px"
                borderColor="border.default"
                borderRadius="10px"
                bg="bg.dialog"
                justify="space-between"
                gap="8px"
              >
                <VStack align="flex-start" gap="0" minW={0}>
                  <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                    {target.name}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                    {target.projectName}
                  </Text>
                </VStack>
                <Button
                  size="xs"
                  variant="outline"
                  flexShrink={0}
                  disabled={!canWrite}
                  onClick={onEditContinuation}
                >
                  {t('data_flow_continuation_change')}
                </Button>
              </HStack>
            ) : (
              <Button
                size="sm"
                variant="outline"
                alignSelf="flex-start"
                disabled={!canWrite}
                onClick={onEditContinuation}
              >
                <Link2 size={14} />
                {t('data_flow_link_step_missing')}
              </Button>
            )}
          </VStack>
        ) : (
          <>
            <FlowParticipantSummary
              label={t('data_flow_from')}
              value={step.from}
              participantOptions={participantOptions}
              disabled={!canWrite}
              onEdit={() => setPicking('from')}
            />
            <FlowParticipantSummary
              label={t('data_flow_to')}
              value={step.to}
              participantOptions={participantOptions}
              disabled={!canWrite}
              onEdit={() => setPicking('to')}
            />
          </>
        )}
      </PanelFieldset>
      {!isLink && endpointOptions.length > 0 ? (
        <VStack align="stretch" gap="8px">
          <Text fontSize="xs" color="fg.muted">
            {t('data_flow_endpoints')}
          </Text>
          <HStack align="flex-end" gap="8px">
            <SearchableSelect
              size="sm"
              flex="1"
              mb={0}
              value={endpointPick}
              onChange={setEndpointPick}
              disabled={!canWrite || availableEndpointOptions.length === 0}
              placeholder={availableEndpointOptions.length ? undefined : t('no_options')}
              options={availableEndpointOptions}
              emptyText={t('data_flow_no_participants')}
            />
            <Button
              size="sm"
              variant="outline"
              flexShrink={0}
              disabled={!canWrite || !endpointPick}
              onClick={() => {
                if (!endpointPick) return;
                onPatch(step.id, {
                  endpointIds: [...(step.endpointIds || []), endpointPick],
                });
                setEndpointPick('');
              }}
            >
              <Plus size={12} />
              {t('data_flow_attach')}
            </Button>
          </HStack>
          {(step.endpointIds || []).map((id) => {
            const option = endpointSelectOptions.find((item) => item.value === id);
            return (
              <HStack
                key={id}
                px="10px"
                py="6px"
                borderWidth="1px"
                borderColor="border.default"
                borderRadius="10px"
                bg="bg.dialog"
              >
                <Text flex="1" minW={0} lineClamp={1} fontSize="sm" color="fg.default">
                  {option?.label ?? id}
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  minW="auto"
                  h="24px"
                  px="6px"
                  disabled={!canWrite}
                  onClick={() =>
                    onPatch(step.id, {
                      endpointIds: (step.endpointIds || []).filter((item) => item !== id),
                    })
                  }
                >
                  <Trash2 size={12} />
                </Button>
              </HStack>
            );
          })}
        </VStack>
      ) : null}

      {!isLink && channelOptions.length > 0 ? (
        <VStack align="stretch" gap="8px">
          <Text fontSize="xs" color="fg.muted">
            {t('data_flow_channels')}
          </Text>
          <HStack align="flex-end" gap="8px">
            <SearchableSelect
              size="sm"
              flex="1"
              mb={0}
              value={channelPick}
              onChange={setChannelPick}
              disabled={!canWrite || availableChannelOptions.length === 0}
              placeholder={availableChannelOptions.length ? undefined : t('no_options')}
              options={availableChannelOptions}
              emptyText={t('data_flow_no_participants')}
            />
            <Button
              size="sm"
              variant="outline"
              flexShrink={0}
              disabled={!canWrite || !channelPick}
              onClick={() => {
                if (!channelPick) return;
                onPatch(step.id, {
                  channelIds: [...(step.channelIds || []), channelPick],
                });
                setChannelPick('');
              }}
            >
              <Plus size={12} />
              {t('data_flow_attach')}
            </Button>
          </HStack>
          {(step.channelIds || []).map((id) => {
            const option = channelSelectOptions.find((item) => item.value === id);
            return (
              <HStack
                key={id}
                px="10px"
                py="6px"
                borderWidth="1px"
                borderColor="border.default"
                borderRadius="10px"
                bg="bg.dialog"
              >
                <Text flex="1" minW={0} lineClamp={1} fontSize="sm" color="fg.default">
                  {option?.label ?? id}
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  minW="auto"
                  h="24px"
                  px="6px"
                  disabled={!canWrite}
                  onClick={() =>
                    onPatch(step.id, {
                      channelIds: (step.channelIds || []).filter((item) => item !== id),
                    })
                  }
                >
                  <Trash2 size={12} />
                </Button>
              </HStack>
            );
          })}
        </VStack>
      ) : null}

      {!isLink && connectionOptions.length > 0 ? (
        <VStack align="stretch" gap="8px">
          <Text fontSize="xs" color="fg.muted">
            {t('data_flow_connections')}
          </Text>
          <HStack align="flex-end" gap="8px">
            <SearchableSelect
              size="sm"
              flex="1"
              mb={0}
              value={connectionPick}
              onChange={setConnectionPick}
              disabled={!canWrite || availableConnectionOptions.length === 0}
              placeholder={availableConnectionOptions.length ? undefined : t('no_options')}
              options={availableConnectionOptions}
              emptyText={t('data_flow_no_participants')}
            />
            <Button
              size="sm"
              variant="outline"
              flexShrink={0}
              disabled={!canWrite || !connectionPick}
              onClick={() => {
                if (!connectionPick) return;
                const [sourceId, targetId] = connectionPick.split('->') as [string, string];
                onPatch(step.id, {
                  connections: [...(step.connections || []), { sourceId, targetId }],
                });
                setConnectionPick('');
              }}
            >
              <Plus size={12} />
              {t('data_flow_attach')}
            </Button>
          </HStack>
          {(step.connections || []).map((conn) => {
            const key = `${conn.sourceId}->${conn.targetId}`;
            const option = connectionSelectOptions.find((item) => item.value === key);
            return (
              <HStack
                key={key}
                px="10px"
                py="6px"
                borderWidth="1px"
                borderColor="border.default"
                borderRadius="10px"
                bg="bg.dialog"
              >
                <Text flex="1" minW={0} lineClamp={1} fontSize="sm" color="fg.default">
                  {option?.label ?? key}
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  minW="auto"
                  h="24px"
                  px="6px"
                  disabled={!canWrite}
                  onClick={() =>
                    onPatch(step.id, {
                      connections: (step.connections || []).filter(
                        (item) =>
                          !(item.sourceId === conn.sourceId && item.targetId === conn.targetId)
                      ),
                    })
                  }
                >
                  <Trash2 size={12} />
                </Button>
              </HStack>
            );
          })}
        </VStack>
      ) : null}

      <FlowParticipantPickerDialog
        open={picking != null}
        onClose={() => setPicking(null)}
        title={pickingTitle}
        value={pickingValue}
        onChange={picking === 'to' ? handleToChange : handleFromChange}
        participantOptions={participantOptions}
        currentProjectId={currentProjectId}
      />
    </VStack>
  );
}

export default memo(FlowStepPropertiesPanel);
