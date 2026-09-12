import BaseEditDialog from '@components/common/BaseEditDialog';
import { panelIdentity } from '@components/common/PanelIdentity';
import ElementGroupField from '@components/common/ElementGroupField';
import ElementTagsField from '@components/common/ElementTagsField';
import ThemedSelect from '@components/common/ThemedSelect';
import ThemedTextField from '@components/common/ThemedTextField';
import { useColorMode } from '@contexts/ColorModeContext';
import type { AuditExtras, TableColumn } from '@/types/c4Extensions';
import { normalizeGroup, sanitizeTags } from '@/types/c4Extensions';
import { TABLE_DATA_TYPES } from '@/types/c4Extensions';
import { Plus, Trash2 } from 'lucide-react';
import {
  Box,
  Checkbox,
  IconButton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type TableEditDialogProps = {
  open: boolean;
  initialName?: string;
  initialColumns?: TableColumn[];
  initialTags?: string[];
  availableTags?: string[];
  initialGroup?: string;
  availableGroups?: string[];
  onSave: (name: string, columns: TableColumn[], tags: string[], group: string) => void;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  audit?: AuditExtras | null;
};

function newColumn(partial?: Partial<TableColumn>): TableColumn {
  return {
    id: crypto.randomUUID(),
    name: partial?.name || 'column',
    dataType: partial?.dataType || 'text',
    primaryKey: partial?.primaryKey || false,
    nullable: partial?.nullable ?? true,
  };
}

export default function TableEditDialog({
  open,
  initialName = '',
  initialColumns = [],
  initialTags = [],
  availableTags = [],
  initialGroup = '',
  availableGroups = [],
  onSave,
  onClose,
  readOnly = false,
  audit,
}: TableEditDialogProps) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  const [name, setName] = useState(initialName);
  const [columns, setColumns] = useState<TableColumn[]>(initialColumns);
  const [tags, setTags] = useState<string[]>(() => sanitizeTags(initialTags));
  const [group, setGroup] = useState(() => normalizeGroup(initialGroup));

  const dataTypeOptions = useMemo(
    () => TABLE_DATA_TYPES.map((dt) => ({ value: dt, label: dt })),
    []
  );

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setColumns(
      initialColumns.length
        ? initialColumns.map((c) => ({ ...c }))
        : [newColumn({ name: 'id', dataType: 'uuid', primaryKey: true, nullable: false })]
    );
    setTags(sanitizeTags(initialTags));
    setGroup(normalizeGroup(initialGroup));
  }, [open, initialName, initialColumns, initialTags, initialGroup]);

  const updateColumn = (id: string, patch: Partial<TableColumn>) => {
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.primaryKey === true) {
          next.nullable = false;
        }
        return next;
      })
    );
  };

  const setPrimaryKey = (id: string, checked: boolean) => {
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, primaryKey: checked, nullable: checked ? false : c.nullable };
        }
        if (checked) return { ...c, primaryKey: false };
        return c;
      })
    );
  };

  return (
    <BaseEditDialog
      open={open}
      title={t('edit_table')}
      identity={panelIdentity(name, {
        onNameChange: (v) => setName(v),
        placeholder: t('table_name'),
      })}
      tagsAndGroup={
        <>
          <ElementTagsField
            tags={tags}
            catalog={availableTags}
            onChange={setTags}
          />
          <ElementGroupField
            group={group}
            catalog={availableGroups}
            onChange={setGroup}
          />
        </>
      }
      onClose={onClose}
      readOnly={readOnly}
      audit={audit}
      onSave={() => onSave(name.trim() || 'table', columns, tags, group)}
      saveDisabled={!name.trim()}
    >

        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Text fontSize="sm" fontWeight="600" color="fg.muted">
            {t('columns')}
          </Text>
          <IconButton
            size="sm"
            variant="ghost"
            data-testid="table-add-column"
            onClick={() => setColumns((prev) => [...prev, newColumn()])}
            color="fg.muted"
            aria-label={t('columns')}
          >
            <Plus size={18} />
          </IconButton>
        </Box>

        <Box
          display="grid"
          gridTemplateColumns="minmax(0, 1.5fr) minmax(0, 1fr) 52px 56px 40px"
          gap="8px"
          px="8px"
          mb="6px"
        >
          <Text fontSize="xs" color={chrome.textMuted}>
            {t('column_name')}
          </Text>
          <Text fontSize="xs" color={chrome.textMuted}>
            {t('column_type')}
          </Text>
          <Text fontSize="xs" color={chrome.textMuted} textAlign="center">
            {t('primary_key')}
          </Text>
          <Text fontSize="xs" color={chrome.textMuted} textAlign="center">
            {t('nullable')}
          </Text>
          <Box />
        </Box>

        <VStack gap="8px" align="stretch">
          {columns.map((col) => (
            <Box
              key={col.id}
              display="grid"
              gridTemplateColumns="minmax(0, 1.5fr) minmax(0, 1fr) 52px 56px 40px"
              gap="8px"
              alignItems="center"
              px="8px"
              py="6px"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.default"
              bg="bg.muted"
            >
              <ThemedTextField
                size="small"
                value={col.name}
                onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                placeholder={t('column_name')}
              />
              <ThemedSelect
                mb="0"
                value={col.dataType}
                onChange={(v) => updateColumn(col.id, { dataType: v })}
                options={dataTypeOptions}
              />
              <Box display="flex" justifyContent="center">
                <Checkbox.Root
                  size="sm"
                  colorPalette="brand"
                  checked={Boolean(col.primaryKey)}
                  onCheckedChange={(d) => setPrimaryKey(col.id, Boolean(d.checked))}
                  aria-label={t('primary_key')}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
              </Box>
              <Box display="flex" justifyContent="center">
                <Checkbox.Root
                  size="sm"
                  colorPalette="brand"
                  checked={col.primaryKey ? false : col.nullable !== false}
                  disabled={Boolean(col.primaryKey)}
                  onCheckedChange={(d) =>
                    updateColumn(col.id, { nullable: Boolean(d.checked) })
                  }
                  aria-label={t('nullable')}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
              </Box>
              <Box display="flex" justifyContent="center">
                <IconButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setColumns((prev) => prev.filter((c) => c.id !== col.id))}
                  disabled={columns.length <= 1}
                  colorPalette="red"
                  aria-label={t('delete')}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </VStack>
    </BaseEditDialog>
  );
}
