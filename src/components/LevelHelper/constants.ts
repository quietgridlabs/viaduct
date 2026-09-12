import type { HelperLevel } from './types';

/** How many tips each level ships — keys are `helper_<level>_tip_<n>`. */
export const TIP_COUNT: Record<HelperLevel, number> = {
  system: 5,
  container: 5,
  component: 4,
  code: 4,
};

export const HELPER_PANEL_WIDTH = '270px';
/** Tips differ in length; a fixed height keeps the panel from jumping. */
export const HELPER_TIP_MIN_HEIGHT = '62px';

export const HELPER_BUTTON_SIZE = '38px';
export const HELPER_DUCK_SIZE = 22;
export const HELPER_ICON_SIZE = 14;
