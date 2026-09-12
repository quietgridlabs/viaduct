import type { ComponentBlock, ConnectionInfo } from '@archivisio/c4-modelizer-sdk';
import type {
  ChannelRole,
  ConnectionExtras,
  EdgePathType,
} from '@/types/c4Extensions';

export type EditableConnection = ConnectionInfo & ConnectionExtras;

export type RelatedComponentOption = ComponentBlock & {
  containerName: string;
};

export type ConnectionEditDialogProps = {
  open: boolean;
  connection: EditableConnection | null;
  onClose: () => void;
  /** Read access only: the panel opens to be read, not filled in. */
  readOnly?: boolean;
  onSave: (connectionInfo: EditableConnection) => void;
  /** Components from source + target containers (container-level edges). */
  relatedComponentOptions?: RelatedComponentOption[];
  /** When set, this edge touches a broker — show produce/consume. */
  channelBinding?: {
    sourceIsBroker: boolean;
    targetIsBroker: boolean;
  } | null;
};

export type ConnectionValues = {
  label: string;
  technology: string;
  description: string;
  labelPosition: number;
  bidirectional: boolean;
  relatedComponentIds: string[];
  pathType: EdgePathType;
  channelRole: ChannelRole;
};

export type RelatedPickerItem = {
  label: string;
  value: string;
  name: string;
  containerName: string;
};
