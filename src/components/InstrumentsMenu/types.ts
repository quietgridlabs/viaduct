import type { ReactNode } from 'react';

export type InstrumentsMenuItem = {
  key: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** Shown on an item that opens but cannot be written to, e.g. for a viewer. */
  hint?: string;
  onClick: () => void;
};

export type InstrumentsMenuRowProps = {
  item: InstrumentsMenuItem;
};
