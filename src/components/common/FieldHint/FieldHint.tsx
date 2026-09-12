import { Box, Portal, Tooltip } from '@chakra-ui/react';
import { Info } from 'lucide-react';

/**
 * The sentence explaining a field, folded into a mark beside its label.
 *
 * A hint is read once and then never again, but a paragraph under a control
 * goes on taking two lines of the panel forever, and in a column this narrow
 * it wrapped to three. As a mark it costs nothing until someone wants it, and
 * it sits with the label because that is what it explains.
 */
export default function FieldHint({ text }: { text: string }) {
  return (
    <Tooltip.Root openDelay={200} closeDelay={80} positioning={{ placement: 'top' }}>
      <Tooltip.Trigger asChild>
        <Box
          as="span"
          display="inline-flex"
          alignItems="center"
          color="fg.subtle"
          /* A hand, like everything else on this panel that answers to a
             pointer. `help` is the semantically tidy one and the only cursor
             in the product that would have looked like a stray. */
          cursor="pointer"
          /* The label is a <label>: a click here would focus the control and
             put a caret where the person wanted an explanation. */
          onClick={(event) => event.preventDefault()}
          aria-label={text}
        >
          <Info size={13} />
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
            maxW="240px"
            borderRadius="md"
            boxShadow="float"
          >
            {text}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}
