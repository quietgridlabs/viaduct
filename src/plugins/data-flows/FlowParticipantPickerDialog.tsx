import SearchableSelect, {
  type SearchableSelectOption,
} from '@components/common/SearchableSelect';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import ThemedSelect from '@components/common/ThemedSelect';
import { fetchDomainElements, useDomainMap, type DomainElement } from '@features/domains';
import { participantKey, parseParticipantKey } from '@utils/dataFlows';
import { isDatabaseTechnology } from '@utils/databaseTech';
import type { FlowParticipantRef } from '@/types/c4Extensions';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Button, Dialog, Field, HStack, Portal, Text, VStack } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const THIS_PROJECT = '';
/** A domain's own elements plus its name — the endpoint has no "list by id",
    only a name search, and every element in a domain matches on that branch. */
const REMOTE_PAGE_LIMIT = 50;

function domainParticipantGroup(hit: DomainElement): string {
  if (hit.type === 'system') return 'Systems';
  return isDatabaseTechnology(hit.technology) ? 'Databases' : 'Containers';
}

function emptyRef(): FlowParticipantRef {
  return { id: '', type: 'container' };
}

function initialDomainId(
  value: FlowParticipantRef,
  currentProjectId?: string
): string {
  return value.projectId && value.projectId !== currentProjectId
    ? value.domainId || ''
    : THIS_PROJECT;
}

export function resolveParticipantDisplay(
  value: FlowParticipantRef | null | undefined,
  options: SearchableSelectOption[]
): { title: string; subtitle?: string } {
  if (!value?.id) return { title: '' };
  if (value.name) {
    const subtitle = [value.projectName, value.domainName].filter(Boolean).join(' · ');
    return { title: value.name, subtitle: subtitle || undefined };
  }
  const key = participantKey(value);
  const option = options.find((item) => item.value === key);
  if (option) {
    return { title: option.label, subtitle: option.detail };
  }
  return { title: value.id };
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  value: FlowParticipantRef;
  onChange: (ref: FlowParticipantRef) => void;
  participantOptions: SearchableSelectOption[];
  currentProjectId?: string;
};

/**
 * Pick a hop endpoint in a dialog.
 *
 * Lived inline in the properties pane before; switching steps left the
 * domain dropdown's local state on the previous hop, so To looked empty
 * even when a system was already set. A fresh dialog each open keeps the
 * draft tied to the value being edited.
 */
export default function FlowParticipantPickerDialog({
  open,
  onClose,
  title,
  value,
  onChange,
  participantOptions,
  currentProjectId,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const queryClient = useQueryClient();
  const { domains } = useDomainMap();

  const [draft, setDraft] = useState<FlowParticipantRef>(value);
  const [domainId, setDomainId] = useState(() => initialDomainId(value, currentProjectId));
  const [remoteHits, setRemoteHits] = useState<DomainElement[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setDraft(value?.id ? value : emptyRef());
    setDomainId(initialDomainId(value, currentProjectId));
  }, [open, value, currentProjectId]);

  const domainOptions = useMemo(
    () => [
      { value: THIS_PROJECT, label: t('data_flow_domain_this_project') },
      ...[...domains]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ value: d.domainId || d.id, label: d.name })),
    ],
    [domains, t]
  );
  const activeDomain = domains.find((d) => (d.domainId || d.id) === domainId) || null;

  useEffect(() => {
    if (!open || !domainId || !activeDomain) {
      setRemoteHits([]);
      return;
    }
    const requestId = ++requestRef.current;
    setRemoteLoading(true);
    const level = activeDomain.level === 'system' ? 'system' : 'container';
    void fetchDomainElements(queryClient, {
      level,
      q: activeDomain.name,
      limit: REMOTE_PAGE_LIMIT,
      offset: 0,
    })
      .then(({ elements }) => {
        if (requestRef.current !== requestId) return;
        setRemoteHits(elements.filter((el) => el.domainId === domainId));
      })
      .catch(() => {
        if (requestRef.current !== requestId) return;
        setRemoteHits([]);
      })
      .finally(() => {
        if (requestRef.current === requestId) setRemoteLoading(false);
      });
  }, [open, domainId, activeDomain, queryClient]);

  const remoteOptions = useMemo<SearchableSelectOption[]>(
    () =>
      remoteHits.map((hit) => ({
        value: hit.id,
        label: hit.name,
        detail: hit.projectName,
        group: domainParticipantGroup(hit),
      })),
    [remoteHits]
  );
  const remoteById = useMemo(() => new Map(remoteHits.map((h) => [h.id, h])), [remoteHits]);

  const setLocal = (next: string) => {
    setDraft(parseParticipantKey(next) || emptyRef());
  };

  const setRemote = (id: string) => {
    const hit = remoteById.get(id);
    if (!hit) return;
    const type = hit.type === 'system' ? 'system' : 'container';
    if (hit.projectId === currentProjectId) {
      setDraft({ id: hit.id, type });
      return;
    }
    setDraft({
      id: hit.id,
      type,
      projectId: hit.projectId,
      name: hit.name,
      projectName: hit.projectName,
      domainId: hit.domainId,
      domainName: hit.domainName,
    });
  };

  const switchDomain = (next: string) => {
    setDomainId(next);
    setDraft(emptyRef());
  };

  const apply = () => {
    if (!draft.id) return;
    onChange(draft);
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
      onInteractOutside={(e) => {
        /* SearchableSelect / ThemedSelect popovers portal outside the dialog
           subtree — without this, picking an option closes the dialog. */
        const target = e.detail.originalEvent.target;
        if (
          target instanceof Element &&
          (target.closest('[data-part="content"]') ||
            target.closest('[data-part="positioner"]') ||
            target.closest('[role="listbox"]'))
        ) {
          e.preventDefault();
        }
      }}
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800} css={{ '--z-index': '1800 !important' }}>
          <Dialog.Content
            data-testid="flow-participant-picker-dialog"
            color="fg.default"
            minW="320px"
            maxW="480px"
            w="calc(100% - 32px)"
            {...glass.dialog}
          >
            <Dialog.Header px={DIALOG_PAD.headerPx} pt={DIALOG_PAD.headerPt} pb={DIALOG_PAD.headerPb}>
              <Dialog.Title fontWeight="600">{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body
              px={DIALOG_PAD.bodyPx}
              py={DIALOG_PAD.bodyPy}
              display="flex"
              flexDirection="column"
              gap={DIALOG_PAD.fieldGap}
            >
              <Text fontSize="sm" color="fg.muted" lineHeight="1.55">
                {t('data_flow_participant_picker_hint')}
              </Text>
              <Field.Root>
                <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
                  {t('domain_field')}
                </Field.Label>
                <ThemedSelect
                  size="sm"
                  options={domainOptions}
                  value={domainId}
                  ariaLabel={t('domain_field')}
                  onChange={switchDomain}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
                  {t('data_flow_pick_participant')}
                </Field.Label>
                {domainId ? (
                  <SearchableSelect
                    options={remoteOptions}
                    value={draft.id}
                    onChange={setRemote}
                    disabled={remoteLoading}
                    placeholder={
                      remoteLoading
                        ? t('data_flow_domain_loading')
                        : t('data_flow_pick_participant')
                    }
                    emptyText={
                      remoteLoading
                        ? t('data_flow_domain_loading')
                        : t('data_flow_domain_empty')
                    }
                  />
                ) : (
                  <SearchableSelect
                    options={participantOptions}
                    value={participantKey(draft)}
                    onChange={setLocal}
                    placeholder={t('data_flow_pick_participant')}
                    emptyText={t('data_flow_no_participants')}
                  />
                )}
              </Field.Root>
            </Dialog.Body>
            <Dialog.Footer
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              gap="8px"
            >
              <HStack w="full" justify="flex-end" gap="8px">
                <Button variant="ghost" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button onClick={apply} disabled={!draft.id}>
                  {t('data_flow_participant_apply')}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

type SummaryProps = {
  label: string;
  value: FlowParticipantRef;
  participantOptions: SearchableSelectOption[];
  disabled?: boolean;
  onEdit: () => void;
};

/** Read-only From/To row — the picker lives in a dialog. */
export function FlowParticipantSummary({
  label,
  value,
  participantOptions,
  disabled,
  onEdit,
}: SummaryProps) {
  const { t } = useTranslation();
  const display = resolveParticipantDisplay(value, participantOptions);

  return (
    <VStack align="stretch" gap="6px">
      <Text fontSize="sm" color="fg.muted" lineHeight="1.2">
        {label}
      </Text>
      {display.title ? (
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
              {display.title}
            </Text>
            {display.subtitle ? (
              <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                {display.subtitle}
              </Text>
            ) : null}
          </VStack>
          <Button
            size="xs"
            variant="outline"
            flexShrink={0}
            disabled={disabled}
            onClick={onEdit}
          >
            {t('data_flow_continuation_change')}
          </Button>
        </HStack>
      ) : (
        <Button
          size="sm"
          variant="outline"
          alignSelf="flex-start"
          disabled={disabled}
          onClick={onEdit}
        >
          {t('data_flow_pick_participant')}
        </Button>
      )}
    </VStack>
  );
}
