import type { ReactNode } from 'react';

export type WorkspaceNavPillProps = {
  projectMode?: boolean;
  projectName?: string | null;
  onRenameProject?: (name: string) => void;
  viewOnly?: boolean;
  readOnly?: boolean;
  /** Position relative to canvas shell instead of viewport. */
  onCanvas?: boolean;
};

/** One level of the C4 descent, as the pill would draw it. */
export type C4Segment = {
  key: string;
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
};

/** The single crumb the pill shows: where you are right now. */
export type CurrentCrumb = {
  icon: ReactNode;
  label: string;
  testId: string;
};

export type CrumbButtonProps = {
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  label: string;
  title?: string;
  testId?: string;
};

export type ProjectNameFieldProps = {
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  /** Escape puts the field back to the name the project actually has. */
  onRevert: () => void;
  disabled: boolean;
  viewOnly: boolean;
};
