import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Button, Dialog, HStack, Portal, Text, VStack } from '@chakra-ui/react';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MAX_ROWS = 6;
const MAX_COLS = 6;

type Props = {
  open: boolean;
  onInsert: (rows: number, cols: number) => void;
  onClose: () => void;
};

/**
 * Table size as a grid you sweep, not two number fields — picking 3×4 is a
 * shape, and the shape is easier to see than to read.
 */
export default function InsertTableDialog({ open, onInsert, onClose }: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [hover, setHover] = useState({ rows: 2, cols: 2 });

  useEffect(() => {
    if (open) setHover({ rows: 2, cols: 2 });
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="insert-table-dialog"
            color="fg.default"
            maxW="360px"
            w="calc(100% - 32px)"
            {...glass.dialog}
          >
            <Dialog.Header
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
            >
              <Dialog.Title fontWeight="600">{t('documentation_table_insert')}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body px={DIALOG_PAD.bodyPx} py="8px">
              <VStack align="stretch" gap="10px">
                <Box>
                  {Array.from({ length: MAX_ROWS }, (_, r) => (
                    <HStack key={r} gap="4px" mb="4px">
                      {Array.from({ length: MAX_COLS }, (_, c) => {
                        const rows = r + 1;
                        const cols = c + 1;
                        const active = rows <= hover.rows && cols <= hover.cols;
                        return (
                          <Box
                            key={c}
                            data-testid={`table-cell-${rows}x${cols}`}
                            w="28px"
                            h="22px"
                            borderRadius="4px"
                            borderWidth="1px"
                            borderColor={active ? 'accent.solid' : 'border.default'}
                            bg={active ? 'accent.subtle' : 'bg.muted'}
                            cursor="pointer"
                            onMouseEnter={() => setHover({ rows, cols })}
                            onFocus={() => setHover({ rows, cols })}
                            onClick={() => {
                              onInsert(rows, cols);
                              onClose();
                            }}
                          />
                        );
                      })}
                    </HStack>
                  ))}
                </Box>
                <Text fontSize="sm" color="fg.muted">
                  {t('documentation_table_size', { rows: hover.rows, cols: hover.cols })}
                </Text>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer
              gap="8px"
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              justifyContent="flex-end"
            >
              <Button
                variant="outline"
                onClick={onClose}
                borderColor="border.strong"
                color="fg.default"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => {
                  onInsert(hover.rows, hover.cols);
                  onClose();
                }}
                bg="bg.neutral.emphasis"
                color="fg.onNeutral"
                _hover={{ bg: 'bg.neutral.emphasis.hover' }}
              >
                {t('documentation_insert')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
