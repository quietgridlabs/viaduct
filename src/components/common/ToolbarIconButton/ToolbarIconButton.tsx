import { IconButton, IconButtonProps, Portal, Tooltip } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import { forwardRef } from 'react';
import { GLASS_RADIUS_BAR } from '@theme/glassSurfaces';

export const TOOLBAR_ICON_SIZE = 18;

export type ToolbarIconButtonProps = IconButtonProps & {
  /** Keep pressed/hover look while an attached menu is open. */
  active?: boolean;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
};

export const ToolbarIconButton = forwardRef<HTMLButtonElement, ToolbarIconButtonProps>(
  function ToolbarIconButton(
    {
      children,
      active = false,
      title,
      tooltipPlacement = 'bottom',
      ...props
    },
    ref
  ) {
    const button = (
      <IconButton
        ref={ref}
        variant="ghost"
        size="sm"
        minW="28px"
        h="28px"
        minH="28px"
        color={props.color ?? 'fg.muted'}
        borderRadius={GLASS_RADIUS_BAR}
        borderWidth="0"
        boxShadow="none"
        transition="background 0.12s ease, opacity 0.12s ease"
        _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
        _expanded={{ bg: 'bg.list.selected', boxShadow: 'none' }}
        _active={{ bg: 'bg.list.selected', boxShadow: 'none' }}
        _disabled={{ opacity: 0.35, cursor: 'not-allowed' }}
        {...props}
        spinner={props.spinner ?? <QuackSpinner size="sm" color="currentColor" />}
        mr={props.mr ?? '0'}
        cursor={props.disabled ? 'not-allowed' : 'pointer'}
        bg={active ? 'bg.list.selected' : (props.bg ?? 'transparent')}
        aria-expanded={active || props['aria-expanded']}
        data-active={active || undefined}
      >
        {children}
      </IconButton>
    );

    if (!title) return button;

    return (
      <Tooltip.Root
        openDelay={350}
        closeDelay={80}
        disabled={Boolean(active)}
        positioning={{ placement: tooltipPlacement }}
      >
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Portal>
          <Tooltip.Positioner>
            <Tooltip.Content
              bg="bg.dialog"
              color="fg.default"
              borderWidth="1px"
              borderColor="border.default"
              px="8px"
              py="4px"
              fontSize="xs"
              borderRadius="md"
              boxShadow="float"
            >
              {title}
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Portal>
      </Tooltip.Root>
    );
  }
);
