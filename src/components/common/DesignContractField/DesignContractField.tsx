import ContractSlot from '@components/common/ContractSlot';
import DesignContractEditorDialog from '@components/common/DesignContractEditorDialog';
import {
  designContractLooksBroken,
  summarizeDesignContract,
} from '@components/common/DesignContract';
import { Frame } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  /** Whose design this is — its connections are what the composition offers. */
  elementId?: string;
  value: string;
  /** Inherited from the container; shown so the tokens have a named source. */
  designSystem?: string;
  onChange: (next: string) => void;
  /** The panel is for reading: the design still opens, for reading too. */
  readOnly?: boolean;
};

/** The design slot on a UI element — same row as the contract slots beside it. */
export default function DesignContractField({
  elementId,
  value,
  designSystem,
  onChange,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ContractSlot
        label={t('design_contract_label')}
        icon={<Frame size={14} />}
        preview={summarizeDesignContract(value, t('design_contract_none'))}
        hasContract={Boolean(value.trim())}
        broken={designContractLooksBroken(value)}
        brokenLabel={t('design_contract_broken')}
        onOpen={() => setOpen(true)}
        onClear={() => onChange('')}
        testId="design-contract-slot"
        readOnly={readOnly}
      />

      {open ? (
        <DesignContractEditorDialog
          open
          elementId={elementId}
          initialValue={value}
          designSystem={designSystem}
          readOnly={readOnly}
          onApply={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
