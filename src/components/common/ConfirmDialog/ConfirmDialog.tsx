import { useGlassSurface } from '@theme/glassSurfaces';
import { Button, Dialog, Portal, Text } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DIALOG_PAD } from '../BaseEditDialog';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  content: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  content,
  onCancel,
  onConfirm,
  confirmText,
  cancelText,
  confirmLoading = false,
}) => {
  const { t } = useTranslation();
  const glass = useGlassSurface();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onCancel();
      }}
      role="alertdialog"
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="confirm-dialog"
            color="fg.default"
            maxW="420px"
            w="calc(100% - 32px)"
            {...glass.dialog}
          >
            {title && (
              <Dialog.Header
                px={DIALOG_PAD.headerPx}
                pt={DIALOG_PAD.headerPt}
                pb={DIALOG_PAD.headerPb}
              >
                <Dialog.Title fontWeight="600">{title}</Dialog.Title>
              </Dialog.Header>
            )}
            <Dialog.Body px={DIALOG_PAD.bodyPx} py={title ? '8px' : DIALOG_PAD.bodyPy} pb="8px">
              <Text color="fg.muted" lineHeight="1.55">
                {content}
              </Text>
            </Dialog.Body>
            <Dialog.Footer
              gap="8px"
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              justifyContent="flex-end"
            >
              <Button
                variant="outline"
                data-testid="cancel-button"
                onClick={onCancel}
                disabled={confirmLoading}
                borderColor="border.strong"
                color="fg.default"
              >
                {cancelText || t('cancel')}
              </Button>
              <Button
                data-testid="confirm-button"
                onClick={onConfirm}
                disabled={confirmLoading}
                bg="bg.neutral.emphasis"
                color="fg.onNeutral"
                _hover={{ bg: 'bg.neutral.emphasis.hover' }}
              >
                {confirmLoading ? <QuackSpinner size="sm" /> : null}
                {confirmText || t('confirm')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default ConfirmDialog;
