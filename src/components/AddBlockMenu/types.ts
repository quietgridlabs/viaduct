import type { FlatC4Model, ViewLevel } from '@archivisio/c4-modelizer-sdk';

export type AddBlockMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  anchorPosition?: { top: number; left: number } | null;
  viewLevel: ViewLevel;
  canAdd: boolean;
  model: FlatC4Model;
};

export type MenuRowProps = {
  primary: string;
  secondary?: string;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
};
