import { useColorMode } from '@contexts/ColorModeContext';
import { tagChipColors, useTagColors } from '@/features/tags/tagColors';
import { Tag, type TagRootProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';

export type ElementTagSize = 'card' | 'field' | 'rail';

const SIZE_STYLES: Record<
  ElementTagSize,
  Pick<TagRootProps, 'h' | 'px' | 'py' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 'borderRadius'>
> = {
  card: {
    h: '18px',
    px: '8px',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.02em',
    borderRadius: '4px',
  },
  field: {
    h: 'auto',
    px: '8px',
    py: '2px',
    fontSize: 'xs',
    fontWeight: '600',
    borderRadius: '4px',
  },
  rail: {
    h: '26px',
    px: '8px',
    fontSize: 'sm',
    fontWeight: '500',
    borderRadius: '6px',
  },
};

export type ElementTagProps = Omit<TagRootProps, 'size'> & {
  tag: string;
  active?: boolean;
  tagSize?: ElementTagSize;
  children?: ReactNode;
  end?: ReactNode;
};

/**
 * One catalog tag, painted the same on a card, in the rail, and in the editor.
 * Built on Chakra Tag so label truncation, close triggers, and composition
 * stay consistent across those three surfaces.
 */
export default function ElementTag({
  tag,
  active = false,
  tagSize = 'card',
  children,
  end,
  asChild,
  ...rest
}: ElementTagProps) {
  const { mode } = useColorMode();
  const tagColor = useTagColors();
  const chip = tagChipColors(tagColor(tag), mode, active);

  const rootProps = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: end || tagSize === 'field' ? '4px' : undefined,
    maxW: '100%',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid' as const,
    borderColor: chip.borderColor,
    bg: chip.bg,
    color: chip.color,
    title: tag,
    ...SIZE_STYLES[tagSize],
    ...rest,
  };

  if (asChild) {
    return (
      <Tag.Root asChild {...rootProps}>
        {children}
      </Tag.Root>
    );
  }

  return (
    <Tag.Root {...rootProps}>
      <Tag.Label truncate={tagSize === 'card'} lineClamp={tagSize === 'card' ? 1 : undefined}>
        {children ?? tag}
      </Tag.Label>
      {end}
    </Tag.Root>
  );
}
