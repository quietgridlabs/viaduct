import type { AuditExtras } from '@/types/c4Extensions';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, HStack, VStack } from '@chakra-ui/react';
import AuditMetaText from '../AuditMetaText';
import { PanelFieldContext } from '../PanelFieldContext';
import { PanelFieldset, PanelIdentityHead, panelFormCss } from '../PanelForm';
import SidePanelShell from '../SidePanelShell';

export type DialogThemeType = 'system' | 'container' | 'component' | 'code' | 'connection';

/** Shared chrome spacing — keep Share / Confirm in sync. */
export const DIALOG_PAD = {
  headerPx: '24px',
  headerPt: '20px',
  headerPb: '14px',
  bodyPx: '24px',
  bodyPy: '20px',
  footerPx: '24px',
  footerPy: '14px',
  fieldGap: '12px',
  labelMb: '6px',
} as const;

export interface BaseEditDialogProps {
  open: boolean;
  title: string;
  /**
   * The element itself, for the panel head: its mark, its name and what it is
   * built with. Given one, the head names the element rather than the action —
   * "Edit container" is the one thing on the panel a person already knows,
   * having just opened it from that card.
   */
  identity?: {
    icon?: ReactNode;
    name: string;
    meta?: string;
    /** Given, the name in the head is the field — there is no second one below. */
    onNameChange?: (next: string) => void;
    /** Hint for the empty name field; the panel's own title if absent. */
    placeholder?: string;
  };
  /** Sits above the switcher: the description, which is read far more than the
   *  rest of the form and belongs with the name rather than among the fields. */
  intro?: ReactNode;
  /** The second tab. The switcher appears only when there is one. */
  tagsAndGroup?: ReactNode;
  children?: ReactNode;
  onSave: () => void;
  onClose: () => void;
  saveDisabled?: boolean;
  /**
   * Viewing, not editing: no way to change anything and no Save to suggest
   * otherwise. The panel is the same panel — someone with read access came to
   * read the card, and sending them somewhere else to do it would be its own
   * kind of rudeness.
   */
  readOnly?: boolean;
  audit?: AuditExtras | null;
}

export default function BaseEditDialog({
  open,
  title,
  identity,
  intro,
  tagsAndGroup,
  children,
  onSave,
  onClose,
  saveDisabled = false,
  readOnly = false,
  audit,
}: BaseEditDialogProps) {
  const [tab, setTab] = useState<'details' | 'meta'>('details');
  const { t } = useTranslation();

  /* Back to the first tab whenever the panel opens on something new: the tab
     a person left behind on the last element says nothing about this one. */
  useEffect(() => {
    if (open) setTab('details');
  }, [open, identity?.name]);



  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[data-testid="confirm-dialog"]')) return;
      if (document.querySelector('[data-testid="json-contract-dialog"]')) return;
      if (document.querySelector('[data-testid="http-contract-dialog"]')) return;
      if (document.querySelector('[data-testid="channel-schema-dialog"]')) return;
      if (document.querySelector('[data-testid="protobuf-contract-dialog"]')) return;
      if (document.querySelector('[role="listbox"]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <SidePanelShell
        title={
          identity ? (
            <PanelIdentityHead identity={identity} title={title} readOnly={readOnly} />
          ) : (
            title
          )
        }
        onClose={onClose}
        closeLabel={t('cancel')}
        side="right"
        width="354px"
        data-panel="element-edit"
        footer={
          <Box w="full">
            {audit ? (
              <Box mb="10px">
                <AuditMetaText audit={audit} />
              </Box>
            ) : null}
            <HStack w="full" justify="flex-end" gap="8px">
              <Button
                type="button"
                data-testid="dialog-cancel-button"
                variant="ghost"
                color="fg.muted"
                onClick={onClose}
              >
                {readOnly ? t('close') : t('cancel')}
              </Button>
              {readOnly ? null : (
              <Button
                type="button"
                data-testid="dialog-save-button"
                onClick={onSave}
                disabled={saveDisabled}
                bg={saveDisabled ? 'border.default' : 'bg.neutral.emphasis'}
                color={saveDisabled ? 'fg.subtle' : 'fg.onNeutral'}
                opacity={saveDisabled ? 0.6 : 1}
                cursor={saveDisabled ? 'not-allowed' : 'pointer'}
                _hover={
                  saveDisabled
                    ? undefined
                    : { bg: 'bg.neutral.emphasis.hover', color: 'fg.onNeutral' }
                }
              >
                {t('save')}
              </Button>
              )}
            </HStack>
          </Box>
        }
      >
        <PanelFieldContext.Provider value={!readOnly}>
          <VStack
            align="stretch"
            gap={DIALOG_PAD.fieldGap}
            px="16px"
            py="16px"
            css={panelFormCss(readOnly)}
          >
            <PanelFieldset readOnly={readOnly}>{intro}</PanelFieldset>
          {tagsAndGroup ? (
            <HStack
              gap="0"
              w="full"
              borderWidth="1px"
              borderColor="border.input"
              borderRadius="md"
              overflow="hidden"
              data-testid="panel-tabs"
            >
              {(
                [
                  ['details', t('panel_tab_details')],
                  ['meta', t('panel_tab_tags_group')],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  flex="1"
                  h="32px"
                  minW="0"
                  borderRadius="0"
                  variant="ghost"
                  bg={tab === key ? 'bg.list.selected' : 'transparent'}
                  color="fg.default"
                  fontWeight={tab === key ? '600' : '500'}
                  fontSize="xs"
                  _hover={{ bg: tab === key ? 'bg.list.selected' : 'bg.list.hover' }}
                  onClick={() => setTab(key)}
                  data-testid={`panel-tab-${key}`}
                >
                  {label}
                </Button>
              ))}
            </HStack>
          ) : null}
          {/* Both tabs stay mounted: half this form is uncontrolled input state
              and a combobox that has been unmounted comes back empty.
              The switcher above stays outside the fieldset — reading the other
              tab is reading, and disabling the way to it would be locking a
              reader out of half the card. */}
          <PanelFieldset readOnly={readOnly}>
            <Box display={tab === 'details' ? 'contents' : 'none'}>{children}</Box>
            {tagsAndGroup ? (
              <Box display={tab === 'meta' ? 'contents' : 'none'}>{tagsAndGroup}</Box>
            ) : null}
          </PanelFieldset>
          </VStack>
        </PanelFieldContext.Provider>
      </SidePanelShell>

    </>
  );
}

/** Kept for ShareDialog / FkEditDialog that still import style helpers. */
export function createDialogPaperStyles(
  _c4: { border: string },
  chrome: { shadow: string; border: string },
  mode: 'light' | 'dark' = 'dark'
) {
  const isLight = mode === 'light';
  return {
    bg: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(28, 26, 32, 0.78)',
    backdropFilter: 'blur(20px) saturate(1.35)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.35)',
    color: 'fg.default',
    borderWidth: '1px',
    borderColor: isLight ? 'rgba(40, 28, 18, 0.16)' : 'rgba(255, 255, 255, 0.13)',
    borderRadius: '10px',
    boxShadow: chrome.shadow,
  };
}
