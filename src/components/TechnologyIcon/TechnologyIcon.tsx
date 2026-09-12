import { useColorMode } from '@contexts/ColorModeContext';
import { getTechnologyById } from '@data/technologies';
import { getIconComponent } from '@icons/TechnologyIcons';
import { Box, Portal, Tooltip } from '@chakra-ui/react';
import { isVeryLightHex } from './helpers';
import type { TechnologyIconProps } from './types';

export default function TechnologyIcon({
  item,
  size = 24,
  showTooltip = true,
}: TechnologyIconProps) {
  const { mode } = useColorMode();
  if (!item.technology) return null;

  const technology = getTechnologyById(item.technology);
  if (!technology) return null;

  const IconComponent = getIconComponent(technology.id);
  const color =
    mode === 'light' && isVeryLightHex(technology.color) ? '#475569' : technology.color;

  const content = (
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      w={`${size}px`}
      h={`${size}px`}
      color={color}
      data-testid={`technology_icon_${technology.id}`}
      aria-label={technology.name}
    >
      <IconComponent size={size} />
    </Box>
  );

  if (showTooltip) {
    return (
      <Tooltip.Root openDelay={350} closeDelay={80} positioning={{ placement: 'top' }}>
        <Tooltip.Trigger asChild>{content}</Tooltip.Trigger>
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
              {technology.name}
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Portal>
      </Tooltip.Root>
    );
  }

  return content;
}
