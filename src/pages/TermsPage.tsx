import LegalPage from './legal/LegalPage';
import { TERMS_SECTIONS } from './legal/legalContent';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="What you can expect from Viaduct, and what we expect from you. Plain enough to read in one sitting — if a clause is unclear, ask and we will explain it."
      sections={TERMS_SECTIONS}
      sibling={{ to: '/privacy', label: 'Privacy Policy →' }}
    />
  );
}
