import { useTranslation } from 'react-i18next';
import { ErrorBox } from './ErrorBox';
import type { ErrorNotificationProps } from './types';

export default function ErrorNotification({ message }: ErrorNotificationProps) {
  const { t } = useTranslation();

  if (!message) return null;

  // Prefer i18n key when present; otherwise show the raw notice (e.g. edit locks).
  const translated = t(message);
  const text = translated === message && message.includes(' ') ? message : translated;

  return <ErrorBox>{text}</ErrorBox>;
}
