import { NodePreset, presetsForLevel } from '@/plugins/arch-tools/presets/catalog';
import {
  SCHEMA_TABLE_PRESETS,
  columnsWithIds,
  defaultIdColumn,
} from '@/plugins/arch-tools/presets/schemaTables';
import { useAddElementInView } from '@hooks/useAddElementInView';
import { isDatabaseSchemaView } from '@utils/databaseTech';
import { isBrokerView, protocolFromBrokerTech } from '@utils/brokerTech';
import {
  BROKER_CHANNEL_PRESETS,
  defaultChannelName,
} from '@/plugins/arch-tools/presets/brokerChannels';
import { pointAnchorRect } from '@utils/menuAnchor';
import { Menu, Portal, Separator, Text } from '@chakra-ui/react';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { useTranslation } from 'react-i18next';
import MenuRow from './MenuRow';
import {
  ADD_MENU_MAX_HEIGHT,
  ADD_MENU_MIN_WIDTH,
  DEFAULT_CHANNEL_SCHEMA_FORMAT,
  DEFAULT_ENDPOINT_METHOD,
  DEFAULT_ENDPOINT_NAME,
  DEFAULT_ENDPOINT_PATH,
  DEFAULT_PERSON_NAME,
  DEFAULT_TABLE_NAME,
} from './constants';
import type { AddBlockMenuProps } from './types';

export default function AddBlockMenu({
  open,
  onClose,
  anchorEl = null,
  anchorPosition = null,
  viewLevel,
  canAdd,
  model,
}: AddBlockMenuProps) {
  const { t } = useTranslation();
  const { addElementInView, handleAddElementInView } = useAddElementInView();
  const schemaMode = isDatabaseSchemaView(model);
  const brokerMode = isBrokerView(model);
  const presets = schemaMode || brokerMode ? [] : presetsForLevel(viewLevel);
  const brokerProtocol = protocolFromBrokerTech(
    model.containers.find((c) => c.id === model.activeContainerId)?.technology
  );
  const usePosition = Boolean(anchorPosition);

  const applyPreset = (preset: NodePreset) => {
    if (!canAdd) return;
    onClose();
    addElementInView({
      name: preset.name,
      description: preset.elementDescription || '',
      technology: preset.technology || '',
      url: preset.url || '',
      type: viewLevel,
      ...(preset.codeType ? { codeType: preset.codeType } : {}),
      ...(preset.kind === 'endpoint'
        ? {
            kind: 'endpoint',
            method: preset.method || DEFAULT_ENDPOINT_METHOD,
            endpoint: preset.endpoint || DEFAULT_ENDPOINT_PATH,
          }
        : {}),
      ...(preset.kind === 'person' ? { kind: 'person' } : {}),
      ...(preset.kind === 'channel'
        ? {
            kind: 'channel',
            protocol: preset.technology || brokerProtocol,
          }
        : {}),
    });
  };

  const addEmptyTable = () => {
    if (!canAdd) return;
    onClose();
    addElementInView({
      name: DEFAULT_TABLE_NAME,
      type: 'component',
      columns: [defaultIdColumn()],
    });
  };

  const applyTablePreset = (preset: (typeof SCHEMA_TABLE_PRESETS)[number]) => {
    if (!canAdd) return;
    onClose();
    addElementInView({
      name: preset.name,
      type: 'component',
      columns: columnsWithIds(preset.columns),
    });
  };

  const addPerson = () => {
    if (!canAdd) return;
    onClose();
    addElementInView({
      name: DEFAULT_PERSON_NAME,
      description: '',
      type: viewLevel,
      kind: 'person',
    });
  };

  const addEmptyChannel = () => {
    if (!canAdd) return;
    onClose();
    addElementInView({
      name: defaultChannelName(brokerProtocol),
      description: '',
      type: 'component',
      kind: 'channel',
      protocol: brokerProtocol,
      schemaFormat: DEFAULT_CHANNEL_SCHEMA_FORMAT,
    });
  };

  const applyChannelPreset = (preset: (typeof BROKER_CHANNEL_PRESETS)[number]) => {
    if (!canAdd) return;
    onClose();
    addElementInView({
      name: preset.name,
      description: '',
      type: 'component',
      kind: 'channel',
      protocol: brokerProtocol,
      schemaFormat: preset.schemaFormat,
    });
  };

  const addEmptyEndpoint = () => {
    if (!canAdd) return;
    onClose();
    addElementInView({
      name: DEFAULT_ENDPOINT_NAME,
      description: '',
      type: 'component',
      kind: 'endpoint',
      method: DEFAULT_ENDPOINT_METHOD,
      endpoint: DEFAULT_ENDPOINT_PATH,
    });
  };

  return (
    <Menu.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      positioning={
        usePosition && anchorPosition
          ? {
              gutter: 0,
              getAnchorRect: () =>
                pointAnchorRect(anchorPosition.left, anchorPosition.top),
            }
          : {
              placement: 'right',
              getAnchorRect: () => anchorEl?.getBoundingClientRect() ?? null,
            }
      }
    >
      <Portal>
        <Menu.Positioner>
          <GlassMenuContent
            minW={ADD_MENU_MIN_WIDTH}
            maxH={ADD_MENU_MAX_HEIGHT}
            overflowY="auto"
            ml={usePosition ? 0 : '8px'}
          >
            {schemaMode ? (
              <MenuRow
                testId="toolbar-add-empty-table"
                primary={t('add_empty_table')}
                secondary={t('add_empty_table_hint')}
                disabled={!canAdd}
                onClick={addEmptyTable}
              />
            ) : brokerMode ? (
              <MenuRow
                testId="toolbar-add-empty-channel"
                primary={t('add_empty_channel')}
                secondary={t('add_empty_channel_hint')}
                disabled={!canAdd}
                onClick={addEmptyChannel}
              />
            ) : (
              <MenuRow
                testId="toolbar-add-empty"
                primary={t('add_empty_block')}
                secondary={t('add_empty_block_hint')}
                disabled={!canAdd}
                onClick={() => {
                  onClose();
                  handleAddElementInView();
                }}
              />
            )}
            {!schemaMode && !brokerMode && (viewLevel === 'system' || viewLevel === 'container') && (
              <MenuRow
                testId="toolbar-add-person"
                primary={t('add_person')}
                secondary={t('add_person_hint')}
                disabled={!canAdd}
                onClick={addPerson}
              />
            )}
            {!schemaMode && !brokerMode && viewLevel === 'component' && (
              <MenuRow
                testId="toolbar-add-endpoint"
                primary={t('add_api_endpoint')}
                secondary={t('add_api_endpoint_hint')}
                disabled={!canAdd}
                onClick={addEmptyEndpoint}
              />
            )}
            {schemaMode && (
              <>
                <Separator my="4px" />
                {SCHEMA_TABLE_PRESETS.map((preset) => (
                  <MenuRow
                    key={preset.id}
                    testId={`toolbar-add-table-preset-${preset.id}`}
                    primary={preset.label}
                    secondary={preset.description}
                    disabled={!canAdd}
                    onClick={() => applyTablePreset(preset)}
                  />
                ))}
              </>
            )}
            {brokerMode && (
              <>
                <Separator my="4px" />
                {BROKER_CHANNEL_PRESETS.map((preset) => (
                  <MenuRow
                    key={preset.id}
                    testId={`toolbar-add-channel-preset-${preset.id}`}
                    primary={preset.label}
                    secondary={preset.description}
                    disabled={!canAdd}
                    onClick={() => applyChannelPreset(preset)}
                  />
                ))}
              </>
            )}
            {!schemaMode && !brokerMode && presets.length > 0 && <Separator my="4px" />}
            {!schemaMode && !brokerMode &&
              presets.map((preset) => (
                <MenuRow
                  key={preset.id}
                  testId={`toolbar-add-preset-${preset.id}`}
                  primary={preset.label}
                  secondary={
                    preset.technology
                      ? `${preset.description} · ${preset.technology}`
                      : preset.description
                  }
                  disabled={!canAdd}
                  onClick={() => applyPreset(preset)}
                />
              ))}
            {!canAdd && (
              <>
                <Separator my="4px" />
                <Menu.Item value="need" disabled cursor="not-allowed">
                  <Text fontSize="xs" color="fg.muted">
                    {viewLevel === 'container'
                      ? t('add_need_system')
                      : viewLevel === 'component'
                        ? t('add_need_container')
                        : viewLevel === 'code'
                          ? t('add_need_component')
                          : ''}
                  </Text>
                </Menu.Item>
              </>
            )}
          </GlassMenuContent>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
