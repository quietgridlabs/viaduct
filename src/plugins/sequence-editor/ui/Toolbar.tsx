import GlassMenuContent from '@components/common/GlassMenuContent';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { WORKSPACE_EDITOR_OVERLAY_Z } from '@theme/sidePanelLayout';
import { Button, HStack, Menu, Portal, Text, VStack } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import { ChevronDown, Code2, Download, FileImage, Redo2, Save, Trash2, Undo2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Participant } from '../domain/sequence-model';
import type { C4CatalogParticipant } from '../host/c4Catalog';
import { useSequenceEditorStore } from '../state/sequence-editor-store';

type Props = {
  readOnly?: boolean;
  onExport: () => void;
  /** Server-rendered image export. */
  onExportImage?: (format: 'svg' | 'png') => void;
  imageExporting?: 'svg' | 'png' | null;
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveError?: string | null;
  onRequestDelete?: () => void;
  onClose?: () => void;
};

export default function SequenceToolbar({
  readOnly,
  onExport,
  onExportImage,
  imageExporting,
  onSave,
  saving,
  saveDisabled,
  saveError,
  onRequestDelete,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const undo = useSequenceEditorStore((s) => s.undo);
  const redo = useSequenceEditorStore((s) => s.redo);
  const past = useSequenceEditorStore((s) => s.past);
  const future = useSequenceEditorStore((s) => s.future);
  const exporting = Boolean(imageExporting);

  return (
    <HStack gap="8px" flexWrap="wrap" align="center" flex="1" justify="flex-end">
      {!readOnly ? (
        <>
          <ToolbarIconButton
            aria-label={t('sequence_undo')}
            title={t('sequence_undo')}
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 size={TOOLBAR_ICON_SIZE} />
          </ToolbarIconButton>
          <ToolbarIconButton
            aria-label={t('sequence_redo')}
            title={t('sequence_redo')}
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={TOOLBAR_ICON_SIZE} />
          </ToolbarIconButton>
        </>
      ) : null}

      <Menu.Root positioning={{ placement: 'bottom-end', gutter: 6 }}>
        <Menu.Trigger asChild>
          <Button
            size="sm"
            variant="ghost"
            borderRadius="full"
            disabled={exporting}
            data-testid="sequence-export"
            aria-label={t('sequence_export')}
            title={t('sequence_export')}
          >
            {exporting ? <QuackSpinner size="xs" /> : <Download size={TOOLBAR_ICON_SIZE} />}
            {t('sequence_export')}
            <ChevronDown size={14} />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner zIndex={WORKSPACE_EDITOR_OVERLAY_Z}>
            <GlassMenuContent minW="220px">
              <Menu.Item
                value="puml"
                data-testid="sequence-export-puml"
                cursor="pointer"
                onClick={onExport}
              >
                <HStack gap="10px" align="center" py="2px">
                  <Code2 size={14} />
                  <VStack align="start" gap="0">
                    <Text fontWeight="600">{t('sequence_export_puml')}</Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('sequence_export_puml_hint')}
                    </Text>
                  </VStack>
                </HStack>
              </Menu.Item>
              {onExportImage ? (
                <>
                  <Menu.Item
                    value="svg"
                    data-testid="sequence-export-svg"
                    cursor="pointer"
                    disabled={exporting}
                    onClick={() => onExportImage('svg')}
                  >
                    <HStack gap="10px" align="center" py="2px">
                      <FileImage size={14} />
                      <VStack align="start" gap="0">
                        <Text fontWeight="600">{t('export_sequence_svg')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('export_sequence_svg_hint')}
                        </Text>
                      </VStack>
                    </HStack>
                  </Menu.Item>
                  <Menu.Item
                    value="png"
                    data-testid="sequence-export-png"
                    cursor="pointer"
                    disabled={exporting}
                    onClick={() => onExportImage('png')}
                  >
                    <HStack gap="10px" align="center" py="2px">
                      <FileImage size={14} />
                      <VStack align="start" gap="0">
                        <Text fontWeight="600">{t('export_sequence_png')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('export_sequence_png_hint')}
                        </Text>
                      </VStack>
                    </HStack>
                  </Menu.Item>
                </>
              ) : null}
            </GlassMenuContent>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {saveError ? (
        <Text fontSize="xs" color="red.400" maxW="140px">
          {saveError}
        </Text>
      ) : null}
      {onSave && !readOnly ? (
        <ToolbarIconButton
          colorPalette="brand"
          color="brand.emphasis"
          aria-label={t('save')}
          title={t('save')}
          loading={saving}
          spinner={<QuackSpinner size="sm" color="currentColor" />}
          disabled={saveDisabled || saving}
          onClick={onSave}
        >
          <Save size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
      ) : null}
      {onRequestDelete && !readOnly ? (
        <ToolbarIconButton
          colorPalette="red"
          color="red.400"
          aria-label={t('sequence_delete')}
          title={t('sequence_delete')}
          onClick={onRequestDelete}
        >
          <Trash2 size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
      ) : null}
      {onClose ? (
        <ToolbarIconButton aria-label={t('close')} title={t('close')} onClick={onClose}>
          <X size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
      ) : null}
    </HStack>
  );
}

export function participantFromCatalog(
  catalogItem: C4CatalogParticipant,
  order: number
): Participant {
  return {
    id: catalogItem.id,
    label: catalogItem.label,
    kind: catalogItem.plantUmlKind,
    order,
    c4EntityId: catalogItem.c4EntityId,
  };
}
