import ThemedTextField from '@components/common/ThemedTextField';
import { ELEMENT_DESCRIPTION_MAX } from '@/types/c4Extensions';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

export type AssistOwnerType = 'system' | 'container' | 'component' | 'code';

export type AssistTargetRef = {
  projectId: string;
  ownerType: AssistOwnerType;
  ownerId: string;
};

type Props = {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Ignored in Community — AI assist is Cloud-only. */
  assist?: AssistTargetRef | null;
  readOnly?: boolean;
};

/** Plain description field (Community has no AI assist). */
export default function AssistDescriptionField({ value, onChange, readOnly }: Props) {
  const { t } = useTranslation();

  return (
    <ThemedTextField
      margin="dense"
      label={t('element_description')}
      fullWidth
      multiline
      minRows={2}
      maxLength={ELEMENT_DESCRIPTION_MAX}
      value={value}
      onChange={onChange}
      disabled={readOnly}
      data-testid="input_description"
    />
  );
}
