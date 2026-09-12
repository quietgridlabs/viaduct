import { useGlassSurface } from '@theme/glassSurfaces';
import { Menu } from '@chakra-ui/react';
import type { ComponentProps } from 'react';

type GlassMenuContentProps = ComponentProps<typeof Menu.Content>;

/** Shared glass chrome for context menus and dropdowns. */
export default function GlassMenuContent({ css, ...rest }: GlassMenuContentProps) {
  const glass = useGlassSurface();
  return (
    <Menu.Content
      color="fg.default"
      {...glass.menu}
      css={{
        '& [role="menuitem"]': { cursor: 'pointer' },
        /* Chakra insets a plain item by 4px and a submenu trigger by nothing,
           so a menu holding both had one row starting further left than the
           rest. */
        '& [data-part="trigger-item"]': { marginInline: '4px' },
        ...glass.scrollbar,
        ...(typeof css === 'object' && css ? css : {}),
      }}
      {...rest}
    />
  );
}
