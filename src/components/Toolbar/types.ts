import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { User } from '@shared/api';
import type { ExportScope } from '@utils/jsonIO';
import type React from 'react';

export type ToolbarProps = {
  onExport?: (scope: ExportScope) => void;
  /** Surfaced when a server-side image export fails. */
  onExportError?: (message: string) => void;
  onImport?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  model?: FlatC4Model;
  user?: User | null;
  projectName?: string | null;
  projectMode?: boolean;
  importLoading?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  onRenameProject?: (name: string) => void | Promise<void>;
  onWebhooks?: () => void;
  viewOnly?: boolean;
  readOnly?: boolean;
  canImport?: boolean;
  peers?: import('@hooks/useYjsProject').PresenceUser[];
  onFollowPeer?: (peer: import('@hooks/useYjsProject').PresenceUser) => void;
  /** Replace the centered level title (e.g. catalog search). */
  center?: React.ReactNode;
  /** Skip the editor tools rail. */
  hideTools?: boolean;
  /** When true, chrome is positioned on the canvas (absolute). Default true. */
  onCanvas?: boolean;
};
