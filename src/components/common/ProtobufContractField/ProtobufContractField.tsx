import ContractSlot from '@components/common/ContractSlot';
import ProtobufContractEditorDialog from '@components/common/ProtobufContractEditorDialog';
import {
  contractLooksBrokenProtobuf,
  summarizeProtobufContract,
  type ProtobufContractSide,
} from '@components/common/ProtobufContract';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  side: ProtobufContractSide;
  label: string;
  value: string;
  onChange: (next: string) => void;
  testId: string;
};

/**
 * Request / response control for a gRPC endpoint. Opens the protobuf editor
 * and shows a one-line digest of the stored message.
 */
export default function ProtobufContractField({
  side,
  label,
  value,
  onChange,
  testId,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const hasContract = Boolean(value.trim());
  const broken = contractLooksBrokenProtobuf(value);
  const preview = summarizeProtobufContract(value, t('json_contract_none'));

  return (
    <>
      <ContractSlot
        label={label}
        preview={preview}
        hasContract={hasContract}
        broken={broken}
        brokenLabel={t('protobuf_contract_broken')}
        onOpen={() => setOpen(true)}
        onClear={() => onChange('')}
        testId={testId}
      />

      {open ? (
        <ProtobufContractEditorDialog
          open
          side={side}
          title={label}
          initialValue={value}
          onApply={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
