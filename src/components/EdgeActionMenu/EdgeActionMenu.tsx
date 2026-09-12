import { Menu, Portal, Separator, Text, VStack } from '@chakra-ui/react';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { pointAnchorRect } from '@utils/menuAnchor';
import { EDGE_PATH_TYPES } from '@/types/c4Extensions';
import { Check, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DISABLED_ITEM_OPACITY,
  EDGE_EXPLORE_MENU_MIN_WIDTH,
  EDGE_MENU_MIN_WIDTH,
  EDGE_PATH_MENU_MIN_WIDTH,
  PATH_ICONS,
} from './constants';
import type { EdgeActionMenuProps } from './types';

export default function EdgeActionMenu({
  anchorPosition,
  open,
  onClose,
  onEdit,
  canEdit = true,
  onExplore,
  onDelete,
  exploreContainers = [],
  showExplore = true,
  canDelete = true,
  pathType = 'bezier',
  onPathTypeChange,
}: EdgeActionMenuProps) {
  const { t } = useTranslation();
  const anyExploreEnabled = exploreContainers.some((c) => c.enabled);

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
          <GlassMenuContent minW={EDGE_MENU_MIN_WIDTH}>
            {canEdit ? (
              <Menu.Item
                value="edit"
                data-testid="edge-menu-edit"
                cursor="pointer"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
              >
                <VStack align="start" gap="0">
                  <Text fontWeight="600">{t('edit_connection')}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {t('edit_connection_menu_hint')}
                  </Text>
                </VStack>
              </Menu.Item>
            ) : null}

            {canEdit && onPathTypeChange && (
              <Menu.Root positioning={{ placement: 'right-start', gutter: 2 }}>
                <Menu.TriggerItem
                  data-testid="edge-menu-path"
                  cursor="pointer"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap="8px"
                >
                  <VStack align="start" gap="0">
                    <Text fontWeight="600">{t('edge_path')}</Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t(`edge_path_${pathType}`)}
                    </Text>
                  </VStack>
                  <ChevronRight size={18} />
                </Menu.TriggerItem>
                <Portal>
                  <Menu.Positioner>
                    <GlassMenuContent minW={EDGE_PATH_MENU_MIN_WIDTH}>
                      {EDGE_PATH_TYPES.map((type) => {
                        const Icon = PATH_ICONS[type];
                        const selected = pathType === type;
                        return (
                          <Menu.Item
                            key={type}
                            value={`path-${type}`}
                            data-testid={`edge-menu-path-${type}`}
                            cursor="pointer"
                            onClick={() => {
                              onPathTypeChange(type);
                              onClose();
                            }}
                          >
                            <Icon size={16} />
                            <Text flex="1" fontWeight={selected ? '600' : '500'}>
                              {t(`edge_path_${type}`)}
                            </Text>
                            {selected ? <Check size={16} /> : null}
                          </Menu.Item>
                        );
                      })}
                    </GlassMenuContent>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            )}

            {showExplore &&
              (anyExploreEnabled ? (
                <Menu.Root positioning={{ placement: 'right-start', gutter: 2 }}>
                  <Menu.TriggerItem
                    data-testid="edge-menu-explore"
                    cursor="pointer"
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="8px"
                  >
                    <VStack align="start" gap="0">
                      <Text fontWeight="600">{t('explore_connection')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('explore_connection_hint')}
                      </Text>
                    </VStack>
                    <ChevronRight size={18} />
                  </Menu.TriggerItem>
                  <Portal>
                    <Menu.Positioner>
                      <GlassMenuContent minW={EDGE_EXPLORE_MENU_MIN_WIDTH}>
                        {exploreContainers.map((c) => (
                          <Menu.Item
                            key={c.id}
                            value={`explore-${c.id}`}
                            data-testid={`edge-menu-explore-${c.id}`}
                            cursor={c.enabled ? 'pointer' : 'not-allowed'}
                            disabled={!c.enabled}
                            opacity={c.enabled ? 1 : DISABLED_ITEM_OPACITY}
                            onClick={() => {
                              if (!c.enabled) return;
                              onExplore(c.id);
                              onClose();
                            }}
                          >
                            <VStack align="start" gap="0">
                              <Text fontWeight="600">
                                {t('explore_connection_in', { name: c.name })}
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                {c.enabled
                                  ? t('explore_connection_in_hint')
                                  : t('explore_connection_in_unavailable')}
                              </Text>
                            </VStack>
                          </Menu.Item>
                        ))}
                      </GlassMenuContent>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              ) : (
                <Menu.Item
                  value="explore-disabled"
                  data-testid="edge-menu-explore"
                  disabled
                  cursor="not-allowed"
                  opacity={DISABLED_ITEM_OPACITY}
                >
                  <VStack align="start" gap="0">
                    <Text fontWeight="600">{t('explore_connection')}</Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('explore_connection_unavailable')}
                    </Text>
                  </VStack>
                </Menu.Item>
              ))}

            {canDelete && (
              <>
                <Separator my="4px" />
                <Menu.Item
                  value="delete"
                  data-testid="edge-menu-delete"
                  color="red.400"
                  cursor="pointer"
                  onClick={() => {
                    onClose();
                    onDelete();
                  }}
                >
                  <VStack align="start" gap="0">
                    <Text fontWeight="600" color="red.400">
                      {t('delete_connection')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('delete_connection_menu_hint')}
                    </Text>
                  </VStack>
                </Menu.Item>
              </>
            )}
          </GlassMenuContent>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
