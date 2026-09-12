import type { TableColumn } from '@/types/c4Extensions';
import BaseEditDialog from '@components/common/BaseEditDialog';
import ThemedSelect from '@components/common/ThemedSelect';
import { Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type FkEditDialogProps = {
  open: boolean;
  sourceTableName: string;
  targetTableName: string;
  sourceColumns: TableColumn[];
  targetColumns: TableColumn[];
  initialSourceColumnId?: string;
  initialTargetColumnId?: string;
  onSave: (sourceColumnId: string, targetColumnId: string) => void;
  onClose: () => void;
};

function pickDefaultSource(cols: TableColumn[], preferred?: string) {
  if (preferred && cols.some((c) => c.id === preferred)) return preferred;
  return cols[0]?.id || '';
}

function pickDefaultTarget(cols: TableColumn[], preferred?: string) {
  if (preferred && cols.some((c) => c.id === preferred)) return preferred;
  const pk = cols.find((c) => c.primaryKey);
  return pk?.id || cols[0]?.id || '';
}

export default function FkEditDialog({
  open,
  sourceTableName,
  targetTableName,
  sourceColumns,
  targetColumns,
  initialSourceColumnId,
  initialTargetColumnId,
  onSave,
  onClose,
}: FkEditDialogProps) {
  const { t } = useTranslation();
  const [sourceColumnId, setSourceColumnId] = useState('');
  const [targetColumnId, setTargetColumnId] = useState('');

  useEffect(() => {
    if (!open) return;
    setSourceColumnId(pickDefaultSource(sourceColumns, initialSourceColumnId));
    setTargetColumnId(pickDefaultTarget(targetColumns, initialTargetColumnId));
  }, [open, sourceColumns, targetColumns, initialSourceColumnId, initialTargetColumnId]);

  const sourceLabel = useMemo(() => {
    const col = sourceColumns.find((c) => c.id === sourceColumnId);
    return col ? `${sourceTableName}.${col.name}` : sourceTableName;
  }, [sourceColumns, sourceColumnId, sourceTableName]);

  const targetLabel = useMemo(() => {
    const col = targetColumns.find((c) => c.id === targetColumnId);
    return col ? `${targetTableName}.${col.name}` : targetTableName;
  }, [targetColumns, targetColumnId, targetTableName]);

  const sourceOptions = useMemo(
    () =>
      sourceColumns.map((c) => ({
        value: c.id,
        label: `${c.name} · ${c.dataType}`,
      })),
    [sourceColumns]
  );

  const targetOptions = useMemo(
    () =>
      targetColumns.map((c) => ({
        value: c.id,
        label: `${c.name} · ${c.dataType}${c.primaryKey ? ' · PK' : ''}`,
      })),
    [targetColumns]
  );

  return (
    <BaseEditDialog
      open={open}
      title={t('edit_foreign_key')}
      onSave={() => onSave(sourceColumnId, targetColumnId)}
      onClose={onClose}
      saveDisabled={!sourceColumnId || !targetColumnId}
    >
      <Text fontSize="sm" color="fg.muted">
        {sourceLabel} → {targetLabel}
      </Text>
      <ThemedSelect
        label={t('fk_source_column')}
        value={sourceColumnId}
        onChange={setSourceColumnId}
        options={sourceOptions}
        placeholder={t('fk_source_column')}
      />
      <ThemedSelect
        label={t('fk_target_column')}
        value={targetColumnId}
        onChange={setTargetColumnId}
        options={targetOptions}
        placeholder={t('fk_target_column')}
      />
    </BaseEditDialog>
  );
}
