import BaseEditDialog from '@components/common/BaseEditDialog';
import { panelIdentity } from '@components/common/PanelIdentity';
import ChannelSchemaField from '@components/common/ChannelSchemaField';
import ElementGroupField from '@components/common/ElementGroupField';
import ElementTagsField from '@components/common/ElementTagsField';
import ThemedSelect from '@components/common/ThemedSelect';
import ThemedTextField from '@components/common/ThemedTextField';
import {
  CHANNEL_COMPATIBILITY,
  CHANNEL_PROTOCOLS,
  CHANNEL_SCHEMA_FORMATS,
  ELEMENT_DESCRIPTION_MAX,
  clampElementDescription,
  normalizeChannelCompatibility,
  normalizeChannelProtocol,
  normalizeChannelSchemaFormat,
  normalizeGroup,
  sanitizeTags,
  type AuditExtras,
  type ChannelCompatibility,
  type ChannelProtocol,
  type ChannelSchemaFormat,
} from '@/types/c4Extensions';
import usePanelValues from '@components/common/UsePanelValues';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type ChannelEditDialogProps = {
  open: boolean;
  initialName?: string;
  initialDescription?: string;
  initialProtocol?: string;
  initialSchemaFormat?: string;
  initialCompatibility?: string;
  initialKeySchema?: string;
  initialValueSchema?: string;
  initialHeadersSchema?: string;
  initialTags?: string[];
  availableTags?: string[];
  initialGroup?: string;
  availableGroups?: string[];
  onSave: (values: {
    name: string;
    description: string;
    protocol: ChannelProtocol;
    schemaFormat: ChannelSchemaFormat;
    compatibility?: ChannelCompatibility;
    keySchema: string;
    valueSchema: string;
    headersSchema: string;
    tags: string[];
    group: string;
  }) => void;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  audit?: AuditExtras | null;
};

type ChannelValues = {
  name: string;
  description: string;
  protocol: ChannelProtocol;
  schemaFormat: ChannelSchemaFormat;
  compatibility: ChannelCompatibility | '';
  keySchema: string;
  valueSchema: string;
  headersSchema: string;
  tags: string[];
  group: string;
};

export default function ChannelEditDialog({
  open,
  initialName = '',
  initialDescription = '',
  initialProtocol = 'kafka',
  initialSchemaFormat = 'avro',
  initialCompatibility = '',
  initialKeySchema = '',
  initialValueSchema = '',
  initialHeadersSchema = '',
  initialTags = [],
  availableTags = [],
  initialGroup = '',
  availableGroups = [],
  onSave,
  onClose,
  readOnly = false,
  audit,
}: ChannelEditDialogProps) {
  const { t } = useTranslation();
  const [values, setValues] = usePanelValues<ChannelValues>(open, {
    name: initialName,
    description: clampElementDescription(initialDescription),
    protocol: normalizeChannelProtocol(initialProtocol),
    schemaFormat: normalizeChannelSchemaFormat(initialSchemaFormat),
    compatibility: normalizeChannelCompatibility(initialCompatibility) || '',
    keySchema: initialKeySchema || '',
    valueSchema: initialValueSchema || '',
    headersSchema: initialHeadersSchema || '',
    tags: sanitizeTags(initialTags),
    group: normalizeGroup(initialGroup),
  });
  const {
    name,
    description,
    protocol,
    schemaFormat,
    compatibility,
    keySchema,
    valueSchema,
    headersSchema,
    tags,
    group,
  } = values;
  const handleChange = <K extends keyof ChannelValues>(field: K, value: ChannelValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const protocolOptions = useMemo(
    () => CHANNEL_PROTOCOLS.map((p) => ({ value: p, label: p })),
    []
  );
  const formatOptions = useMemo(
    () => CHANNEL_SCHEMA_FORMATS.map((f) => ({ value: f, label: f })),
    []
  );
  const compatibilityOptions = useMemo(
    () => [
      { value: '', label: t('channel_compatibility_none') },
      ...CHANNEL_COMPATIBILITY.filter((c) => c !== 'none').map((c) => ({
        value: c,
        label: c,
      })),
    ],
    [t]
  );

  return (
    <BaseEditDialog
      open={open}
      title={t('edit_channel')}
      identity={panelIdentity(name, {
        meta: protocol,
        onNameChange: (v) => handleChange('name', v),
        placeholder: t('channel_name'),
      })}
      intro={
        <ThemedTextField
          margin="dense"
          label={t('element_description')}
          fullWidth
          multiline
          minRows={2}
          maxLength={ELEMENT_DESCRIPTION_MAX}
          value={description}
          onChange={(e) => handleChange('description', e.target.value)}
          data-testid="input_channel_description"
        />
      }
      tagsAndGroup={
        <>
          <ElementTagsField tags={tags} catalog={availableTags} onChange={(v) => handleChange('tags', v)} />
          <ElementGroupField group={group} catalog={availableGroups} onChange={(v) => handleChange('group', v)} />
        </>
      }
      onClose={onClose}
      readOnly={readOnly}
      audit={audit}
      onSave={() =>
        onSave({
          name: name.trim() || 'events.new',
          description: description.trim(),
          protocol,
          schemaFormat,
          compatibility: compatibility
            ? (compatibility as ChannelCompatibility)
            : undefined,
          keySchema,
          valueSchema,
          headersSchema,
          tags,
          group,
        })
      }
      saveDisabled={!name.trim()}
    >
      <ThemedSelect
        label={t('channel_protocol')}
        value={protocol}
        onChange={(v) => handleChange('protocol', normalizeChannelProtocol(v))}
        options={protocolOptions}
        data-testid="input_channel_protocol"
      />
      <ThemedSelect
        label={t('channel_schema_format')}
        value={schemaFormat}
        onChange={(v) => handleChange('schemaFormat', normalizeChannelSchemaFormat(v))}
        options={formatOptions}
        data-testid="input_channel_format"
      />
      <ThemedSelect
        label={t('channel_compatibility')}
        value={compatibility}
        onChange={(v) => handleChange('compatibility', v as ChannelCompatibility | '')}
        options={compatibilityOptions}
        data-testid="input_channel_compatibility"
      />
      <ChannelSchemaField
        side="key"
        label={t('channel_key_schema')}
        value={keySchema}
        format={schemaFormat}
        onChange={(v) => handleChange('keySchema', v)}
        testId="input_channel_key"
      />
      <ChannelSchemaField
        side="value"
        label={t('channel_value_schema')}
        value={valueSchema}
        format={schemaFormat}
        onChange={(v) => handleChange('valueSchema', v)}
        testId="input_channel_value"
      />
      <ChannelSchemaField
        side="headers"
        label={t('channel_headers_schema')}
        value={headersSchema}
        format={schemaFormat}
        onChange={(v) => handleChange('headersSchema', v)}
        testId="input_channel_headers"
      />
    </BaseEditDialog>
  );
}
