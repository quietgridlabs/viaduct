import type { FlowStatus } from '@utils/flowValidation';
import { Box, Portal, Tooltip } from '@chakra-ui/react';
import { CircleCheck, CircleDashed, CircleX, TriangleAlert } from 'lucide-react';
import type { ComponentType } from 'react';

const ICON: Record<FlowStatus, ComponentType<{ size?: number }>> = {
  ok: CircleCheck,
  review: TriangleAlert,
  broken: CircleX,
  unchecked: CircleDashed,
};

const COLOR: Record<FlowStatus, string> = {
  ok: 'green.500',
  review: 'orange.400',
  broken: 'red.400',
  /* A flow nobody has looked at is not a problem, and must not read as one. */
  unchecked: 'fg.subtle',
};

type Props = {
  status: FlowStatus;
  /** What hovering says. Short in a list, the whole explanation in a panel. */
  hint: string;
  size?: number;
};

/**
 * How a Magic flow stands, as a mark rather than a word.
 *
 * A badge spends a chunk of a row to say "checked", which is the state most
 * rows are in and therefore the least worth reading; a mark says the same at a
 * glance and gives the space back. The sentence behind it is still there for
 * anyone who wants it — on hover, where an explanation costs nothing until it
 * is asked for.
 */
export default function FlowStatusIcon({ status, hint, size = 15 }: Props) {
  const Icon = ICON[status];
  return (
    <Tooltip.Root openDelay={200} closeDelay={80} positioning={{ placement: 'top' }}>
      <Tooltip.Trigger asChild>
        <Box
          as="span"
          display="inline-flex"
          alignItems="center"
          color={COLOR[status]}
          cursor="pointer"
          flexShrink={0}
          onClick={(event) => event.preventDefault()}
          aria-label={hint}
          data-testid={`flow-status-icon-${status}`}
        >
          <Icon size={size} />
        </Box>
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content
            bg="bg.dialog"
            color="fg.default"
            borderWidth="1px"
            borderColor="border.default"
            px="10px"
            py="6px"
            fontSize="xs"
            maxW="280px"
            borderRadius="md"
            boxShadow="float"
          >
            {hint}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}
