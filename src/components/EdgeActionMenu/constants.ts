import { type EdgePathType } from '@/types/c4Extensions';
import { CornerDownRight, Minus, Spline } from 'lucide-react';

export const PATH_ICONS: Record<EdgePathType, typeof Spline> = {
  bezier: Spline,
  straight: Minus,
  step: CornerDownRight,
};

/** Menu widths: the root, the path submenu, and the container submenu. */
export const EDGE_MENU_MIN_WIDTH = '280px';
export const EDGE_PATH_MENU_MIN_WIDTH = '200px';
export const EDGE_EXPLORE_MENU_MIN_WIDTH = '240px';

/** A container with nothing to explore stays visible, greyed. */
export const DISABLED_ITEM_OPACITY = 0.45;
