import type { ReactNode } from 'react';

export type AppFooterProps = {
  /** Compact bar for the editor chrome */
  variant?: 'bar' | 'page';
};

export type FooterLinkProps = {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
};

export type FooterColumnProps = {
  title: string;
  children: ReactNode;
};
