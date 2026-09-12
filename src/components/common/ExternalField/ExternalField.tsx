import FieldHint from '@components/common/FieldHint';
import ThemedSelect from '@components/common/ThemedSelect';
import { Building2, House } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * Whether this element is external — someone else's, not this team's.
 *
 * A picked value rather than a checkbox, like the shape and the direction of a
 * connection. A tickbox asks a person to hold a negative in their head: an
 * empty box means internal, which is worked out rather than read. Two named
 * options with a mark each say it outright — our own roof, or another
 * organisation's building — and the sentence about being drawn dimmed moves to
 * the mark beside the label, where the other hints live.
 *
 * The answers are the card's words. A card wears "External" when it is one, so
 * that is what the option says — anything else would be a second vocabulary
 * for a single idea. The label names the question rather than repeating one of
 * its answers, which is what every other row here does too.
 *
 * The model still stores a boolean; only the way it is asked has changed.
 */
export default function ExternalField({ checked, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <ThemedSelect
      label={
        <>
          {t('element_ownership')}
          <FieldHint text={t('external_hint')} />
        </>
      }
      value={checked ? 'external' : 'internal'}
      onChange={(next) => onChange(next === 'external')}
      options={[
        {
          value: 'internal',
          label: t('element_external_internal'),
          icon: <House size={15} />,
        },
        {
          value: 'external',
          label: t('element_external_external'),
          icon: <Building2 size={15} />,
        },
      ]}
      data-testid="input_external"
    />
  );
}
