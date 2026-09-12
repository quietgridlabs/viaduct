import type { TechnologyLevel } from '@archivisio/c4-modelizer-sdk';

export type TechnologySelectProps = {
  fullWidth?: boolean;
  level: TechnologyLevel;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export type TechnologyOptionItem = {
  label: string;
  value: string;
  color: string;
  icon: string;
};
