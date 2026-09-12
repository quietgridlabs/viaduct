export type TipsTourStep = {
  /** `data-tour` value; omit for centered intro/outro cards. */
  target?: string;
  titleKey: string;
  bodyKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

/** The hole cut out of the dimmer, in viewport coordinates. */
export type SpotlightRect = {
  rect: DOMRect;
  pad: number;
  radius: number;
};

export type OnboardingTipsTourProps = {
  open: boolean;
  steps?: TipsTourStep[];
  onClose: () => void;
};
