import { Menu, Portal, Text } from '@chakra-ui/react';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { ChevronRight } from 'lucide-react';
import {
  DISABLED_ITEM_OPACITY,
  NODE_MENU_MIN_WIDTH,
  SUBMENU_CHEVRON_SIZE,
  SUBMENU_GUTTER,
} from './constants';
import type { SubmenuProps } from './types';

/**
 * A branch of the menu. Disabled it keeps its arrow and its place, so the
 * menu does not change shape depending on what you are allowed to do.
 */
export default function Submenu({ testId, label, disabled, children }: SubmenuProps) {
  if (disabled) {
    return (
      <Menu.Item
        value={`${testId}-disabled`}
        data-testid={testId}
        disabled
        cursor="not-allowed"
        opacity={DISABLED_ITEM_OPACITY}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap="8px"
      >
        <Text fontWeight="600">{label}</Text>
        <ChevronRight size={SUBMENU_CHEVRON_SIZE} />
      </Menu.Item>
    );
  }

  return (
    <Menu.Root positioning={{ placement: 'right-start', gutter: SUBMENU_GUTTER }}>
      <Menu.TriggerItem
        data-testid={testId}
        cursor="pointer"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap="8px"
      >
        <Text fontWeight="600">{label}</Text>
        <ChevronRight size={SUBMENU_CHEVRON_SIZE} />
      </Menu.TriggerItem>
      <Portal>
        <Menu.Positioner>
          <GlassMenuContent minW={NODE_MENU_MIN_WIDTH}>{children}</GlassMenuContent>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
