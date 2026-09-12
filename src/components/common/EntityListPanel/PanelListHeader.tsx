import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { pointAnchorRect } from '@utils/menuAnchor';
import { HStack, Menu, Portal, Text } from '@chakra-ui/react';
import { ArrowUpDown, Check } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

/**
 * The two halves of a manager panel's header, for the panel shell to wear.
 *
 * They used to live inside the list, one row below a shell header that spelled
 * out the same word — "Magic flows" above a list of Magic flows. The name is
 * already on the button that opened the panel and on the row the panel came
 * from; a mark and a count say what is left to say, and the row they occupied
 * goes back to the list.
 */
export function PanelCountTitle({ icon, count }: { icon: ReactNode; count: number }) {
  return (
    <HStack gap="6px" minW={0} color="fg.muted">
      {icon}
      <Text fontSize="sm" fontWeight="600" color="fg.default">
        {count}
      </Text>
    </HStack>
  );
}

export type ListSortOption = { key: string; label: string };

export function ListSortMenu({
  sort,
  options,
  onSortChange,
  label,
  testId,
}: {
  sort: string;
  options: ListSortOption[];
  onSortChange: (next: string) => void;
  label: string;
  testId: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <ToolbarIconButton
        ref={buttonRef}
        title={label}
        aria-label={label}
        data-testid={testId}
        active={open}
        onClick={() => setOpen(true)}
      >
        <ArrowUpDown size={TOOLBAR_ICON_SIZE} />
      </ToolbarIconButton>
      <Menu.Root
        open={open}
        onOpenChange={(d) => setOpen(d.open)}
        positioning={{
          placement: 'bottom-end',
          gutter: 8,
          getAnchorRect: () => {
            const rect = buttonRef.current?.getBoundingClientRect();
            return rect ? pointAnchorRect(rect.right, rect.bottom) : null;
          },
        }}
      >
        <Portal>
          <Menu.Positioner>
            <GlassMenuContent minW="220px">
              {options.map((option) => (
                <Menu.Item
                  key={option.key}
                  value={option.key}
                  onClick={() => {
                    onSortChange(option.key);
                    setOpen(false);
                  }}
                >
                  <HStack w="full" justify="space-between" gap="12px">
                    <Text fontSize="sm">{option.label}</Text>
                    {sort === option.key ? <Check size={14} /> : null}
                  </HStack>
                </Menu.Item>
              ))}
            </GlassMenuContent>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </>
  );
}
