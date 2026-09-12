import ContractSlot from '@components/common/ContractSlot';
import ChannelSchemaEditorDialog from '@components/common/ChannelSchemaEditorDialog';
import {
  contractLooksBrokenChannel,
  summarizeChannelSchema,
  type ChannelSchemaSide,
} from '@components/common/ChannelContract';
import type { ChannelSchemaFormat } from '@/types/c4Extensions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  side: ChannelSchemaSide;
  label: string;
  value: string;
  format: ChannelSchemaFormat;
  onChange: (next: string) => void;
  testId: string;
};

/**
 * Key / value / headers control for a broker channel.
 * Opens the same centered Monaco dialog the endpoint contracts use.
 */
export default function ChannelSchemaField({
  side,
  label,
  value,
  format,
  onChange,
  testId,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const hasContract = Boolean(value.trim());
  const broken = contractLooksBrokenChannel(value);
  const preview = summarizeChannelSchema(value, t('json_contract_none'));

  return (
    <>
      <ContractSlot
        label={label}
        preview={preview}
        hasContract={hasContract}
        broken={broken}
        brokenLabel={t('channel_schema_broken')}
        onOpen={() => setOpen(true)}
        onClear={() => onChange('')}
        testId={testId}
      />

      {open ? (
        <ChannelSchemaEditorDialog
          open
          side={side}
          title={label}
          format={format}
          initialValue={value}
          onApply={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
