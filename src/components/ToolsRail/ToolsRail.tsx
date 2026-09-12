import AddBlockMenu, { canAddAtLevel } from '@components/AddBlockMenu';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { useGlassSurface } from '@theme/glassSurfaces';
import { CANVAS_CHROME_INSET } from '@theme/sidePanelLayout';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { pointAnchorRect } from '@utils/menuAnchor';
import PortalTarget from '@slots/PortalTarget';
import { Input, Menu, Portal, VStack } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { Download, Plus, Upload, Webhook } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorMode } from '@contexts/ColorModeContext';
import type { RenderFormat } from '@shared/api';
import ExportMenuRow from './ExportMenuRow';
import {
  EXPORT_MENU_GUTTER,
  EXPORT_MENU_MIN_WIDTH,
  IMPORT_FILE_ACCEPT,
  TOOLS_RAIL_GAP,
  TOOLS_RAIL_PADDING,
  TOOLS_RAIL_Z,
} from './constants';
import { errorMessage, exportDiagramImage } from './helpers';
import type { ToolsRailProps } from './types';

export default function ToolsRail({
  onExport,
  onImport,
  model: modelProp,
  importLoading = false,
  onWebhooks,
  viewOnly,
  readOnly,
  canImport = true,
  onCanvas = true,
  onExportError,
}: ToolsRailProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [renderingFormat, setRenderingFormat] = useState<RenderFormat | null>(null);
  const { mode } = useColorMode();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const locked = Boolean(readOnly || viewOnly);
  const importDisabled = locked || !canImport || importLoading;
  const storeModel = useFlatC4Store((s) => (modelProp ? null : s.model));
  const model = modelProp ?? storeModel!;
  const canAdd = !locked && canAddAtLevel(model);

  const exportImage = useCallback(
    async (format: RenderFormat) => {
      setExportMenuOpen(false);
      setRenderingFormat(format);
      try {
        await exportDiagramImage({ model, theme: mode, format });
      } catch (err) {
        onExportError?.(errorMessage(err));
      } finally {
        setRenderingFormat(null);
      }
    },
    [model, mode, onExportError]
  );

  return (
    <VStack
      role="toolbar"
      aria-label="Editor tools"
      data-tour="tools-rail"
      position={onCanvas ? 'absolute' : 'fixed'}
      top="50%"
      left={CANVAS_CHROME_INSET}
      transform="translateY(-50%)"
      zIndex={TOOLS_RAIL_Z}
      gap={TOOLS_RAIL_GAP}
      p={TOOLS_RAIL_PADDING}
      {...glass.floatBar}
    >
      <ToolbarIconButton
        ref={addButtonRef}
        data-testid="toolbar-add-system"
        data-tour="add-block"
        onClick={() => setAddMenuOpen(true)}
        disabled={locked}
        aria-label={t('add_block')}
        title={t('add_block')}
        mr="0"
        tooltipPlacement="right"
        active={addMenuOpen}
      >
        <Plus size={TOOLBAR_ICON_SIZE} />
      </ToolbarIconButton>
      <AddBlockMenu
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        anchorEl={addButtonRef.current}
        viewLevel={model.viewLevel}
        canAdd={canAdd}
        model={model}
      />

      <PortalTarget id="tools-rail-actions" />

      <ToolbarIconButton
        ref={exportButtonRef}
        data-testid="toolbar-export-model"
        data-tour="export"
        onClick={() => setExportMenuOpen(true)}
        aria-label={renderingFormat ? t('export_rendering') : t('export_json')}
        title={renderingFormat ? t('export_rendering') : t('export_json')}
        mr="0"
        tooltipPlacement="right"
        active={exportMenuOpen}
      >
        {renderingFormat ? <QuackSpinner size="sm" /> : <Download size={TOOLBAR_ICON_SIZE} />}
      </ToolbarIconButton>
      <Menu.Root
        open={exportMenuOpen}
        onOpenChange={(d) => setExportMenuOpen(d.open)}
        positioning={{
          placement: 'right',
          gutter: EXPORT_MENU_GUTTER,
          getAnchorRect: () => {
            const rect = exportButtonRef.current?.getBoundingClientRect();
            return rect
              ? pointAnchorRect(rect.right, rect.top + rect.height / 2)
              : null;
          },
        }}
      >
        <Portal>
          <Menu.Positioner>
            <GlassMenuContent minW={EXPORT_MENU_MIN_WIDTH}>
              <ExportMenuRow
                value="full"
                testId="toolbar-export-full"
                primary={t('export_full_project')}
                secondary={t('export_full_project_hint')}
                onClick={() => {
                  setExportMenuOpen(false);
                  onExport('full');
                }}
              />
              <ExportMenuRow
                value="view"
                testId="toolbar-export-view"
                primary={t('export_current_view')}
                secondary={t('export_current_view_hint')}
                onClick={() => {
                  setExportMenuOpen(false);
                  onExport('current');
                }}
              />
              <ExportMenuRow
                value="svg"
                testId="toolbar-export-svg"
                primary={t('export_diagram_svg')}
                secondary={t('export_diagram_svg_hint')}
                onClick={() => void exportImage('svg')}
              />
              <ExportMenuRow
                value="png"
                testId="toolbar-export-png"
                primary={t('export_diagram_png')}
                secondary={t('export_diagram_png_hint')}
                onClick={() => void exportImage('png')}
              />
            </GlassMenuContent>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <ToolbarIconButton
        data-testid="toolbar-import-model"
        data-tour="import"
        onClick={() => fileInputRef.current?.click()}
        disabled={importDisabled}
        aria-label={importLoading ? 'Importing…' : t('import_json')}
        title={importLoading ? 'Importing…' : t('import_json')}
        mr="0"
        tooltipPlacement="right"
      >
        {importLoading ? <QuackSpinner size="sm" /> : <Upload size={TOOLBAR_ICON_SIZE} />}
      </ToolbarIconButton>
      <Input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_FILE_ACCEPT}
        display="none"
        onChange={onImport}
      />

      {onWebhooks && (
        <ToolbarIconButton
          data-testid="toolbar-webhooks"
          onClick={onWebhooks}
          aria-label="Webhooks"
          title="Webhooks"
          mr="0"
          tooltipPlacement="right"
        >
          <Webhook size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
      )}
    </VStack>
  );
}
