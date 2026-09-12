import {
  channelSurfaceLabel,
  clampElementDescription,
  isBrokerChannel,
  normalizeChannelRole,
  normalizeEdgePathType,
} from '@/types/c4Extensions';
import { inferChannelRole } from '@utils/brokerTech';
import { DEFAULT_LABEL_POSITION } from './constants';
import type {
  ConnectionEditDialogProps,
  ConnectionValues,
  EditableConnection,
  RelatedComponentOption,
  RelatedPickerItem,
} from './types';

export function emptyConnectionValues(
  channelBinding: ConnectionEditDialogProps['channelBinding']
): ConnectionValues {
  return {
    label: '',
    technology: '',
    description: '',
    labelPosition: DEFAULT_LABEL_POSITION,
    bidirectional: false,
    relatedComponentIds: [],
    pathType: 'bezier',
    channelRole: channelBinding ? inferChannelRole(channelBinding) : 'produce',
  };
}

export function valuesFromConnection(
  connection: EditableConnection,
  channelBinding: ConnectionEditDialogProps['channelBinding']
): ConnectionValues {
  return {
    label: connection.label || '',
    technology: connection.technology || '',
    description: clampElementDescription(connection.description || ''),
    labelPosition:
      typeof connection.labelPosition === 'number'
        ? connection.labelPosition
        : DEFAULT_LABEL_POSITION,
    bidirectional: connection.bidirectional || false,
    relatedComponentIds: connection.relatedComponentIds || [],
    pathType: normalizeEdgePathType(connection.pathType),
    channelRole:
      normalizeChannelRole(connection.channelRole) ||
      (channelBinding ? inferChannelRole(channelBinding) : 'produce'),
  };
}

export function relatedPickerItems(
  options: RelatedComponentOption[]
): RelatedPickerItem[] {
  return options.map((c) => ({
    label: isBrokerChannel(c)
      ? `${channelSurfaceLabel((c as { protocol?: string }).protocol)} ${c.name} · ${c.containerName}`
      : `${c.name} · ${c.containerName}`,
    value: c.id,
    name: isBrokerChannel(c)
      ? `${channelSurfaceLabel((c as { protocol?: string }).protocol)} ${c.name}`
      : c.name,
    containerName: c.containerName,
  }));
}
