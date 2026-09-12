import { useGlassSurface } from '@theme/glassSurfaces';
import { Button, Dialog, Field, Input, Portal } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DIALOG_PAD } from '../BaseEditDialog';

type Props = {
  open: boolean;
  title: string;
  label: string;
  /** Prefilled and selected, so typing replaces it and Enter accepts it. */
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
};

/**
 * Ask for one name and nothing else.
 *
 * Same chrome as ConfirmDialog on purpose — creating a folder, a project or
 * anything else that needs a name should not each invent their own window.
 */
export default function NamePromptDialog({
  open,
  title,
  label,
  initialValue = '',
  placeholder,
  confirmText,
  loading = false,
  onCancel,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Reopening is a fresh question — the last answer must not linger. */
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  /* Select the suggestion so the first keystroke replaces it. On the next
     frame, not on focus: the dialog moves focus itself as it opens, and doing
     this any earlier just gets undone. */
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const submit = () => {
    const name = value.trim();
    if (!name || loading) return;
    onSubmit(name);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onCancel();
      }}
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="name-prompt-dialog"
            color="fg.default"
            minW="320px"
            maxW="420px"
            w="calc(100% - 32px)"
            {...glass.dialog}
          >
            <Dialog.Header
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
            >
              <Dialog.Title fontWeight="600">{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body px={DIALOG_PAD.bodyPx} py={DIALOG_PAD.bodyPy}>
              <Field.Root>
                <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
                  {label}
                </Field.Label>
                <Input
                  autoFocus
                  ref={inputRef}
                  data-testid="name-prompt-input"
                  value={value}
                  placeholder={placeholder}
                  minH="40px"
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
              </Field.Root>
            </Dialog.Body>
            <Dialog.Footer
              gap="8px"
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              justifyContent="flex-end"
            >
              <Button
                variant="outline"
                borderColor="border.strong"
                color="fg.default"
                disabled={loading}
                onClick={onCancel}
              >
                {t('cancel')}
              </Button>
              <Button
                data-testid="name-prompt-submit"
                bg="bg.neutral.emphasis"
                color="fg.onNeutral"
                _hover={{ bg: 'bg.neutral.emphasis.hover' }}
                disabled={loading || !value.trim()}
                onClick={submit}
              >
                {loading ? <QuackSpinner size="sm" /> : null}
                {confirmText || t('create')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
