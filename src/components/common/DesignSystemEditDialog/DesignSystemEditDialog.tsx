import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import type { DesignSystemRecord, DesignTokenRecord } from '@/types/c4Extensions';
import DesignSourceKindIcon from '@components/common/DesignSourceKindIcon';
import ThemedSelect from '@components/common/ThemedSelect';
import { useGlassSurface } from '@theme/glassSurfaces';
import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import { mergeTokens, parsePastedTokens } from '@utils/designTokens';
import { Button, Dialog, Field, HStack, Input, Portal, Text, VStack } from '@chakra-ui/react';
import { FileUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  /** null when creating. */
  system: DesignSystemRecord | null;
  onSave: (system: DesignSystemRecord) => void;
  onClose: () => void;
};

const SOURCE_KINDS = ['figma', 'tokens-file', 'code', 'none'] as const;

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ds_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * A design system, named and pointed at its source.
 *
 * For a Figma file the source is a link. For a tokens file the source is the
 * file itself: attach it here and the values land on the system at save —
 * a path in someone else's repository is not something Viaduct can open.
 */
export default function DesignSystemEditDialog({ open, system, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { chrome } = useColorMode();
  const inputStyles = fieldSurfaceFlatStyles(chrome);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>('none');
  const [ref, setRef] = useState('');
  /** Values parsed from an attached tokens file; applied on save. */
  const [fileTokens, setFileTokens] = useState<DesignTokenRecord[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(system?.name ?? '');
    setKind(system?.source?.kind ?? 'none');
    setRef(system?.source?.ref ?? '');
    setFileTokens(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, system]);

  const onTokensFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    try {
      const text = await file.text();
      const tokens = parsePastedTokens(text);
      if (!tokens.length) {
        setFileTokens(null);
        setFileError(t('design_systems_tokens_file_empty'));
        return;
      }
      setRef(file.name);
      setFileTokens(tokens);
    } catch {
      setFileTokens(null);
      setFileError(t('design_systems_tokens_file_unreadable'));
    }
  };

  const clearTokensFile = () => {
    setFileTokens(null);
    setFileError(null);
    setRef('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const base = system ?? { id: newId(), tokens: [] as DesignTokenRecord[] };
    const source =
      kind === 'none' && !ref.trim()
        ? undefined
        : { kind: kind as NonNullable<DesignSystemRecord['source']>['kind'], ref: ref.trim() };

    onSave({
      ...base,
      name: trimmed,
      source,
      ...(fileTokens
        ? {
            tokens: mergeTokens(base.tokens ?? [], fileTokens),
            readAt: new Date().toISOString(),
          }
        : {}),
    });
  };

  return (
    /* Centred, dimmed and above the workspace overlay it is opened from — the
       same shell every other dialog in the product wears. */
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      placement="center"
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="design-system-dialog"
            color="fg.default"
            maxW="520px"
            w="calc(100% - 32px)"
            maxH="min(720px, calc(100dvh - 48px))"
            display="flex"
            flexDirection="column"
            {...glass.dialog}
          >
            <Dialog.Header pb={DIALOG_PAD.headerPb}>
              <Dialog.Title>
                {system ? t('design_systems_edit_title') : t('design_systems_new')}
              </Dialog.Title>
            </Dialog.Header>

            <Dialog.Body overflowY="auto">
              <VStack align="stretch" gap={DIALOG_PAD.fieldGap}>
                <Field.Root>
                  <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
                    {t('design_system_label')}
                  </Field.Label>
                  <Input
                    size="sm"
                    autoFocus
                    value={name}
                    placeholder={t('design_system_placeholder')}
                    data-testid="design-system-name"
                    onChange={(e) => setName(e.target.value)}
                    {...inputStyles}
                  />
                  <Text fontSize="xs" color="fg.subtle" mt="4px">
                    {t('design_systems_name_help')}
                  </Text>
                </Field.Root>

                <ThemedSelect
                  label={t('design_systems_source_kind')}
                  options={SOURCE_KINDS.map((value) => ({
                    value,
                    label: t(`design_systems_source_${value}`),
                    icon: <DesignSourceKindIcon kind={value} size={15} />,
                  }))}
                  value={kind}
                  onChange={(next) => {
                    setKind(next);
                    setFileTokens(null);
                    setFileError(null);
                    if (next !== 'tokens-file' && next !== 'figma' && next !== 'code') {
                      setRef('');
                    }
                  }}
                />

                {kind === 'tokens-file' ? (
                  <Field.Root>
                    <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
                      {t('design_systems_tokens_file')}
                    </Field.Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.tokens,.css,text/plain,application/json"
                      hidden
                      data-testid="design-system-tokens-file"
                      onChange={(e) => void onTokensFile(e.target.files?.[0])}
                    />
                    <HStack gap="8px" align="center" flexWrap="wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp size={14} />
                        {t('design_systems_tokens_file_choose')}
                      </Button>
                      {ref ? (
                        <HStack
                          gap="4px"
                          px="8px"
                          py="4px"
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor="border.default"
                          maxW="100%"
                        >
                          <Text fontSize="xs" fontFamily="mono" lineClamp={1} title={ref}>
                            {ref}
                          </Text>
                          {fileTokens ? (
                            <Text fontSize="xs" color="fg.subtle" whiteSpace="nowrap">
                              ({t('design_systems_tokens_file_count', { count: fileTokens.length })})
                            </Text>
                          ) : null}
                          <Button
                            size="xs"
                            variant="ghost"
                            aria-label={t('delete')}
                            onClick={clearTokensFile}
                          >
                            <X size={12} />
                          </Button>
                        </HStack>
                      ) : null}
                    </HStack>
                    {fileError ? (
                      <Text fontSize="xs" color="red.400" mt="4px">
                        {fileError}
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="fg.subtle" mt="4px" lineHeight="1.5">
                        {t('design_systems_tokens_file_help')}
                      </Text>
                    )}
                  </Field.Root>
                ) : kind !== 'none' ? (
                  <Field.Root>
                    <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
                      {t('design_systems_source_ref')}
                    </Field.Label>
                    <Input
                      size="sm"
                      value={ref}
                      placeholder={
                        kind === 'figma'
                          ? 'https://figma.com/design/8Kd2/Weather'
                          : 'packages/ui/src/theme.ts'
                      }
                      data-testid="design-system-ref"
                      onChange={(e) => setRef(e.target.value)}
                      {...inputStyles}
                    />
                    <Text fontSize="xs" color="fg.subtle" mt="4px">
                      {kind === 'figma'
                        ? t('design_systems_source_figma_help')
                        : t('design_systems_source_code_help')}
                    </Text>
                  </Field.Root>
                ) : null}

                <Text fontSize="xs" color="fg.subtle" lineHeight="1.5">
                  {t('design_systems_values_where')}
                </Text>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap="8px" justify="flex-end" w="full">
                <Button size="sm" variant="ghost" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={!name.trim()}
                  data-testid="design-system-save"
                  onClick={save}
                >
                  {t('save')}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
