import ContractSlot from '@components/common/ContractSlot';
import HttpContractEditorDialog from '@components/common/HttpContractEditorDialog';
import {
  contractLooksBroken,
  summarizeHttpContract,
  type HttpContractSide,
} from '@components/common/HttpContract';
import { isWebSocketMethod } from '@/types/c4Extensions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  side: HttpContractSide;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Endpoint path and verb — the editor checks path params and shows the badge. */
  path?: string;
  method?: string;
  testId: string;
};

/**
 * Request / response control for the endpoint side panel.
 * Opens the OpenAPI-shaped contract editor and shows a one-line digest of
 * whatever is stored.
 */
export default function HttpContractField({
  side,
  label,
  value,
  onChange,
  path,
  method,
  testId,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const channel = isWebSocketMethod(method);
  const hasContract = Boolean(value.trim());
  const broken = contractLooksBroken(value, side, { channel });
  const preview = summarizeHttpContract(value, side, t('json_contract_none'), { channel });

  return (
    <>
      <ContractSlot
        label={label}
        preview={preview}
        hasContract={hasContract}
        broken={broken}
        brokenLabel={t('json_contract_broken')}
        onOpen={() => setOpen(true)}
        onClear={() => onChange('')}
        testId={testId}
      />

      {open ? (
        <HttpContractEditorDialog
          open
          side={side}
          title={label}
          initialValue={value}
          path={path}
          method={method}
          channel={channel}
          onApply={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
