import ThemedSelect from '@components/common/ThemedSelect';
import type { Domain } from '@/types/c4Extensions';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

export type ElementDomainFieldProps = {
  domainId: string;
  domains: Domain[];
  onChange: (domainId: string) => void;
  disabled?: boolean;
};

export default function ElementDomainField({
  domainId,
  domains,
  onChange,
  disabled,
}: ElementDomainFieldProps) {
  const { t } = useTranslation();

  const options = useMemo(
    () => [
      { value: '', label: t('domain_none') },
      ...domains.map((d) => ({ value: d.id, label: d.name })),
    ],
    [domains, t]
  );

  if (!domains.length) return null;

  return (
    <ThemedSelect
      label={t('domain_field')}
      value={domainId}
      disabled={disabled}
      options={options}
      onChange={onChange}
      data-testid="input_domain"
    />
  );
}
