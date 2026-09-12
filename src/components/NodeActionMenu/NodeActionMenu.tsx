import { Menu, Portal, Separator } from '@chakra-ui/react';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { pointAnchorRect } from '@utils/menuAnchor';
import { useTranslation } from 'react-i18next';
import MenuRow from './MenuRow';
import Submenu from './Submenu';
import { NODE_MENU_MIN_WIDTH } from './constants';
import { buildAddItems, buildExportItems } from './helpers';
import type { NodeActionMenuProps } from './types';

export default function NodeActionMenu({
  anchorPosition,
  open,
  onClose,
  onEdit,
  canEdit = true,
  compareVersions,
  onCompareWithVersion,
  onAddSequence,
  showAddSequence = false,
  onAddDocumentation,
  showAddDocumentation = false,
  onImportOpenApi,
  showImportOpenApi = false,
  canAdd = true,
  onExportElement,
  onExportElementSubtree,
  showExportSubtree = false,
  onHighlightChain,
  onClearHighlight,
  showClearHighlight = false,
  onDelete,
  canDelete = true,
}: NodeActionMenuProps) {
  const { t } = useTranslation();

  const addItems = buildAddItems(
    {
      onAddDocumentation,
      showAddDocumentation,
      onAddSequence,
      showAddSequence,
      onImportOpenApi,
      showImportOpenApi,
    },
    t
  );
  const exportItems = buildExportItems(
    { onExportElement, onExportElementSubtree, showExportSubtree },
    t
  );
  const canCompare = Boolean(onCompareWithVersion && compareVersions && compareVersions.length > 0);

  return (
    <Menu.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      positioning={{
        gutter: 0,
        getAnchorRect: () =>
          anchorPosition
            ? pointAnchorRect(anchorPosition.left, anchorPosition.top)
            : null,
      }}
    >
      <Portal>
        <Menu.Positioner>
          <GlassMenuContent minW={NODE_MENU_MIN_WIDTH}>
            {canEdit ? (
              <Menu.Item
                value="edit"
                data-testid="node-menu-edit"
                cursor="pointer"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
              >
                {t('edit')}
              </Menu.Item>
            ) : null}
            {canCompare ? (
              <Submenu testId="node-menu-compare" label={t('compare_with_version')}>
                {compareVersions!.map((v) => (
                  <Menu.Item
                    key={v.id}
                    value={`compare-${v.id}`}
                    data-testid={`node-menu-compare-${v.id}`}
                    cursor="pointer"
                    onClick={() => {
                      onClose();
                      onCompareWithVersion?.(v.id);
                    }}
                  >
                    {v.label}
                  </Menu.Item>
                ))}
              </Submenu>
            ) : null}
            {onHighlightChain && (
              <Menu.Item
                value="highlight-chain"
                data-testid="node-menu-highlight-chain"
                cursor="pointer"
                onClick={() => {
                  onClose();
                  onHighlightChain();
                }}
              >
                {t('highlight_connections')}
              </Menu.Item>
            )}
            {showClearHighlight && onClearHighlight && (
              <Menu.Item
                value="clear-highlight"
                data-testid="node-menu-clear-highlight"
                cursor="pointer"
                onClick={() => {
                  onClose();
                  onClearHighlight();
                }}
              >
                {t('clear_chain_highlight')}
              </Menu.Item>
            )}

            {addItems.length > 0 && (
              <Submenu
                testId="node-menu-add"
                label={t('menu_add')}
                disabled={!canAdd}
              >
                {addItems.map((item) => (
                  <Menu.Item
                    key={item.value}
                    value={item.value}
                    data-testid={item.testId}
                    cursor="pointer"
                    onClick={() => {
                      onClose();
                      item.onClick();
                    }}
                  >
                    <MenuRow title={item.title} hint={item.hint} />
                  </Menu.Item>
                ))}
              </Submenu>
            )}

            {exportItems.length > 0 && (
              <Submenu testId="node-menu-export" label={t('menu_export')}>
                {exportItems.map((item) => (
                  <Menu.Item
                    key={item.value}
                    value={item.value}
                    data-testid={item.testId}
                    cursor="pointer"
                    onClick={() => {
                      onClose();
                      item.onClick();
                    }}
                  >
                    <MenuRow title={item.title} hint={item.hint} />
                  </Menu.Item>
                ))}
              </Submenu>
            )}

            {canDelete && onDelete ? (
              <>
                <Separator my="4px" />
                <Menu.Item
                  value="delete"
                  data-testid="node-menu-delete"
                  color="red.400"
                  cursor="pointer"
                  onClick={() => {
                    onClose();
                    onDelete();
                  }}
                >
                  {t('delete')}
                </Menu.Item>
              </>
            ) : null}
          </GlassMenuContent>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
