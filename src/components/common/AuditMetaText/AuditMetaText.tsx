import { Text, VStack } from '@chakra-ui/react';
import type { AuditExtras } from '@/types/c4Extensions';
import { formatAuditWhen, formatPersonRef } from '@utils/audit';
import { useTranslation } from 'react-i18next';

type Props = {
  audit?: AuditExtras | null;
  compact?: boolean;
};

export default function AuditMetaText({ audit, compact }: Props) {
  const { t } = useTranslation();
  if (!audit) return null;

  const created = formatPersonRef(audit.createdBy);
  const updated = formatPersonRef(audit.updatedBy);
  const updatedAt = formatAuditWhen(audit.updatedAt);
  if (!created && !updated && !updatedAt) return null;

  return (
    <VStack align="start" gap={compact ? '0' : '1px'} minW={0} maxW="420px">
      {created ? (
        <Text fontSize="xs" color="fg.muted" lineClamp={1} title={created}>
          {t('audit_created_by', { person: created })}
        </Text>
      ) : null}
      {updated || updatedAt ? (
        <Text fontSize="xs" color="fg.muted" lineClamp={1} title={[updated, updatedAt].filter(Boolean).join(' · ')}>
          {updated && updatedAt
            ? t('audit_updated_by_at', { person: updated, when: updatedAt })
            : updated
              ? t('audit_updated_by', { person: updated })
              : t('audit_updated_at', { when: updatedAt })}
        </Text>
      ) : null}
    </VStack>
  );
}
