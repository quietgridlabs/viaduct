import LegalPage from './legal/LegalPage';
import { PRIVACY_SECTIONS } from './legal/legalContent';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="What Viaduct collects, why, and what you can ask us to do about it. The short version: your model is yours, we recognise you by the identifier your sign-in provider gives us rather than by your email address, and nothing leaves your browser at all if you work without an account."
      sections={PRIVACY_SECTIONS}
      sibling={{ to: '/terms', label: 'Terms of Service →' }}
    />
  );
}
