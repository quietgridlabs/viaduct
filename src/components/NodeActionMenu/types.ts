import type { ReactNode } from 'react';

export type NodeActionMenuProps = {
  anchorPosition: { top: number; left: number } | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  canEdit?: boolean;
  /** Pinned versions to compare this element against (id → label). */
  compareVersions?: Array<{ id: string; label: string }>;
  onCompareWithVersion?: (snapshotId: string) => void;
  onAddSequence?: () => void;
  showAddSequence?: boolean;
  onAddDocumentation?: () => void;
  showAddDocumentation?: boolean;
  onImportOpenApi?: () => void;
  showImportOpenApi?: boolean;
  canAdd?: boolean;
  onExportElement?: () => void;
  onExportElementSubtree?: () => void;
  showExportSubtree?: boolean;
  onHighlightChain?: () => void;
  onClearHighlight?: () => void;
  showClearHighlight?: boolean;
  onDelete?: () => void;
  canDelete?: boolean;
};

/** One row inside the Add or Export submenu. */
export type NodeMenuAction = {
  value: string;
  testId: string;
  title: string;
  hint: string;
  onClick: () => void;
};

export type SubmenuProps = {
  testId: string;
  label: string;
  disabled?: boolean;
  children: ReactNode;
};

export type MenuRowProps = {
  title: string;
  hint?: string;
};

/** Only the keys the row builders read, so they stay callable from a test. */
export type NodeMenuActionSources = Pick<
  NodeActionMenuProps,
  | 'onAddDocumentation'
  | 'showAddDocumentation'
  | 'onAddSequence'
  | 'showAddSequence'
  | 'onImportOpenApi'
  | 'showImportOpenApi'
  | 'onExportElement'
  | 'onExportElementSubtree'
  | 'showExportSubtree'
>;
