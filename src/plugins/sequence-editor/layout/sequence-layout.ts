export interface SequenceLayoutConfig {
  laneWidth: number;
  firstLaneX: number;
  headerY: number;
  headerHeight: number;
  eventStartY: number;
  eventRowHeight: number;
  bottomPadding: number;
  activationWidth: number;
  fragmentPadding: number;
}

export const DEFAULT_LAYOUT: SequenceLayoutConfig = {
  laneWidth: 220,
  firstLaneX: 120,
  headerY: 24,
  headerHeight: 56,
  eventStartY: 130,
  eventRowHeight: 72,
  bottomPadding: 96,
  activationWidth: 14,
  fragmentPadding: 16,
};

export function laneX(
  order: number,
  config: SequenceLayoutConfig = DEFAULT_LAYOUT
): number {
  return config.firstLaneX + order * config.laneWidth;
}

export function eventY(
  index: number,
  config: SequenceLayoutConfig = DEFAULT_LAYOUT
): number {
  return config.eventStartY + index * config.eventRowHeight;
}
