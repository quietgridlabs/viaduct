import ContractSlot from '@components/common/ContractSlot';
import ElementLinksDialog from '@components/common/ElementLinksDialog';
import type { ElementLink } from '@/types/c4Extensions';
import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  links: ElementLink[];
  onChange: (links: ElementLink[]) => void;
};

/**
 * The element's links, as one row of the panel.
 *
 * Shows what they are called, not where they point: an address is long, mostly
 * boilerplate, and identical between a runbook and a dashboard on the same
 * host. Reads like the contract rows next to it, and opens its list the same
 * way — the same shape for the same kind of thing, a row that stands for
 * something with an editor of its own.
 */
export default function ElementLinksField({ links, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ContractSlot
        label={t('element_links')}
        icon={<Link2 size={14} />}
        preview={
          links.length
            ? links.map((link) => link.label).join(', ')
            : t('field_empty', { label: t('element_links').toLowerCase() })
        }
        hasContract={links.length > 0}
        broken={false}
        brokenLabel=""
        onOpen={() => setOpen(true)}
        onClear={() => onChange([])}
        testId="input_links"
      />
      <ElementLinksDialog
        open={open}
        links={links}
        onApply={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
