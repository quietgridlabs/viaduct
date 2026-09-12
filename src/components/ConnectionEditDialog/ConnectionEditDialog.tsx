import BaseEditDialog from '@components/common/BaseEditDialog';
import { panelIdentity } from '@components/common/PanelIdentity';
import FieldHint from '@components/common/FieldHint';
import EdgePathTypeField from '@components/common/EdgePathTypeField';
import ThemedTextField from '@components/common/ThemedTextField';
import TechnologySelect from '@components/TechnologySelect';
import { useColorMode } from '@contexts/ColorModeContext';
import {
  ELEMENT_DESCRIPTION_MAX,
  normalizeChannelRole,
  type ChannelRole,
  type EdgePathType,
} from '@/types/c4Extensions';
import ThemedSelect from '@components/common/ThemedSelect';
import { MoveHorizontal, MoveRight } from 'lucide-react';
import {
  Badge,
  Combobox,
  Field,
  HStack,
  Portal,
  Text,
  VStack,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConnectionEnd from './ConnectionEnd';
import { RELATED_MENU_MAX_HEIGHT } from './constants';
import {
  emptyConnectionValues,
  relatedPickerItems,
  valuesFromConnection,
} from './helpers';
import type {
  ConnectionEditDialogProps,
  ConnectionValues,
} from './types';

export default function ConnectionEditDialog({
  open,
  connection,
  onClose,
  readOnly = false,
  onSave,
  relatedComponentOptions = [],
  channelBinding = null,
}: ConnectionEditDialogProps) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();

  const [values, setValues] = useState<ConnectionValues>(() =>
    emptyConnectionValues(channelBinding)
  );

  useEffect(() => {
    if (!open) return;
    setValues(
      connection
        ? valuesFromConnection(connection, channelBinding)
        : emptyConnectionValues(channelBinding)
    );
  }, [open, connection, channelBinding]);

  const handleChange = (
    field: keyof ConnectionValues,
    value: string | number | boolean | string[] | EdgePathType | ChannelRole
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: field === 'labelPosition' ? Number(value) : value,
    }));
  };

  const selectedComponents = useMemo(
    () =>
      relatedComponentOptions.filter((c) => values.relatedComponentIds.includes(c.id)),
    [relatedComponentOptions, values.relatedComponentIds]
  );

  const items = useMemo(
    () => relatedPickerItems(relatedComponentOptions),
    [relatedComponentOptions]
  );

  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter } = useListCollection({
    initialItems: items,
    filter: contains,
  });

  useEffect(() => {
    filter('');
  }, [items, filter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof items>();
    for (const item of collection.items) {
      const list = groups.get(item.containerName) || [];
      list.push(item);
      groups.set(item.containerName, list);
    }
    return Array.from(groups.entries());
  }, [collection.items]);

  const handleSave = () => {
    if (!connection) return;

    onSave({
      ...connection,
      label: values.label,
      technology: values.technology,
      description: values.description,
      labelPosition: values.labelPosition,
      bidirectional: values.bidirectional,
      relatedComponentIds: values.relatedComponentIds,
      pathType: values.pathType,
      channelRole: channelBinding ? values.channelRole : undefined,
    });
  };

  const removeRelated = (id: string) => {
    handleChange(
      'relatedComponentIds',
      values.relatedComponentIds.filter((x) => x !== id)
    );
  };

  return (
    <BaseEditDialog
      open={open}
      title={t('edit_connection')}
      identity={panelIdentity(values.label, {
        technology: values.technology,
        onNameChange: (v) => handleChange('label', v),
        placeholder: t('connection_title'),
      })}
      intro={
        <ThemedTextField
          margin="dense"
          label={t('element_description')}
          fullWidth
          multiline
          minRows={2}
          maxLength={ELEMENT_DESCRIPTION_MAX}
          value={values.description}
          onChange={(e) => handleChange('description', e.target.value)}
          data-testid="input_description"
        />
      }
      onSave={handleSave}
      onClose={onClose}
      readOnly={readOnly}
    >
      <ConnectionEnd label={t('connection_sender')} id={connection?.sourceId || ''} />
      <ConnectionEnd label={t('connection_receiver')} id={connection?.targetId || ''} />
      <TechnologySelect
        level="connection"
        value={values.technology}
        onChange={(value) => handleChange('technology', value)}
        label={t('technology')}
        placeholder={t('select_technology')}
      />
      <EdgePathTypeField
        value={values.pathType}
        onChange={(pathType) => handleChange('pathType', pathType)}
      />
      {channelBinding ? (
        <ThemedSelect
          label={t('channel_role')}
          value={values.channelRole}
          onChange={(v) =>
            handleChange('channelRole', normalizeChannelRole(v) || 'produce')
          }
          options={[
            { value: 'produce', label: t('channel_role_produce') },
            { value: 'consume', label: t('channel_role_consume') },
          ]}
          data-testid="input_channel_role"
        />
      ) : null}
      {relatedComponentOptions.length > 0 && (
        <Field.Root mb="0" data-testid="input_related_components">
          <Field.Label color="fg.muted" mb="6px" gap="5px">
            {t('related_components')}
            <FieldHint text={t('related_components_hint')} />
          </Field.Label>
          {selectedComponents.length > 0 && (
            <HStack gap="6px" flexWrap="wrap" mb="8px">
              {selectedComponents.map((c) => (
                <Badge key={c.id} asChild colorPalette="brand" variant="subtle">
                  <button
                    type="button"
                    onClick={() => removeRelated(c.id)}
                    title="Remove"
                    style={{ cursor: 'pointer' }}
                  >
                    {c.name} · {c.containerName} ×
                  </button>
                </Badge>
              ))}
            </HStack>
          )}
          <Combobox.Root
            multiple
            collection={collection}
            value={values.relatedComponentIds}
            onInputValueChange={(d) => filter(d.inputValue)}
            onValueChange={(d) => handleChange('relatedComponentIds', d.value)}
            openOnClick
            width="100%"
            size="md"
          >
            <Combobox.Control>
              <Combobox.Input
                placeholder={t('related_components')}
                bg="bg.dialog"
                color="fg.default"
                borderColor="border.input"
                minH="40px"
                _hover={{ borderColor: 'border.strong' }}
                _focus={{
                  borderColor: 'border.focus',
                  boxShadow: `0 0 0 1px ${chrome.borderFocus}`,
                }}
              />
              <Combobox.IndicatorGroup>
                <Combobox.ClearTrigger />
                <Combobox.Trigger />
              </Combobox.IndicatorGroup>
            </Combobox.Control>
            <Portal>
              <Combobox.Positioner>
                <Combobox.Content
                  bg="bg.dialog"
                  color="fg.default"
                  borderWidth="1px"
                  borderColor="border.default"
                  maxH={RELATED_MENU_MAX_HEIGHT}
                  overflowY="auto"
                  boxShadow="md"
                >
                  {groupedItems.map(([group, groupItems]) => (
                    <Combobox.ItemGroup key={group}>
                      <Combobox.ItemGroupLabel
                        px="12px"
                        py="6px"
                        fontWeight="700"
                        fontSize="xs"
                        color="fg.muted"
                        bg="bg.list.hover"
                      >
                        {group}
                      </Combobox.ItemGroupLabel>
                      {groupItems.map((item) => (
                        <Combobox.Item
                          key={item.value}
                          item={item}
                          _highlighted={{ bg: 'bg.list.hover' }}
                        >
                          <VStack align="flex-start" gap="0">
                            <Text fontSize="sm">{item.name}</Text>
                            <Text fontSize="xs" color={chrome.textMuted}>
                              {t('related_component_from', {
                                container: item.containerName,
                              })}
                            </Text>
                          </VStack>
                          <Combobox.ItemIndicator />
                        </Combobox.Item>
                      ))}
                    </Combobox.ItemGroup>
                  ))}
                  <Combobox.Empty>
                    <Text px="12px" py="8px" color={chrome.textMuted} fontSize="sm">
                      No components
                    </Text>
                  </Combobox.Empty>
                </Combobox.Content>
              </Combobox.Positioner>
            </Portal>
          </Combobox.Root>
        </Field.Root>
      )}
      {/* A picked value, like the shape above it: which way the arrow points is
          the same kind of question as how it is drawn, and a checkbox made you
          read "Bidirectional connection" and work out what the unticked box
          meant. The marks say it without the sentence. */}
      <ThemedSelect
        label={t('connection_direction')}
        value={values.bidirectional ? 'both' : 'one'}
        onChange={(next) => handleChange('bidirectional', next === 'both')}
        options={[
          { value: 'one', label: t('connection_direction_one_way'), icon: <MoveRight size={15} /> },
          {
            value: 'both',
            label: t('connection_direction_both'),
            icon: <MoveHorizontal size={15} />,
          },
        ]}
        data-testid="input_bidirectional"
      />
    </BaseEditDialog>
  );
}
