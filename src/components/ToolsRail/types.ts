import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { ExportScope } from '@utils/jsonIO';
import type React from 'react';

export type ToolsRailProps = {
  onExport: (scope: ExportScope) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  model?: FlatC4Model;
  importLoading?: boolean;
  /** Drawn only for the owner of a saved project — see EditorWorkspace. */
  onWebhooks?: () => void;
  viewOnly?: boolean;
  readOnly?: boolean;
  canImport?: boolean;
  onCanvas?: boolean;
  /** Surfaced when a server-side image export fails. */
  onExportError?: (message: string) => void;
};

export type ExportMenuRowProps = {
  value: string;
  testId: string;
  primary: string;
  secondary: string;
  onClick: () => void;
};
