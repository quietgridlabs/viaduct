import type { DataFlowStage } from '@utils/dataFlows';

/** Where the trunk runs. */
export const FLOW_STEP_RAIL_MAIN_X = 12;
/** Width of the rail column for a flow with no fork wider than two tracks. */
export const FLOW_STEP_RAIL_GUTTER = 38;
/** Where the first track runs, and how far apart the next ones sit. */
export const FLOW_STEP_RAIL_LANE_X = 26;
const LANE_GAP = 13;
const LANE_PAD = 12;

export function flowRailLaneX(armIndex: number): number {
  return FLOW_STEP_RAIL_LANE_X + armIndex * LANE_GAP;
}

/**
 * How wide the rail column has to be for the widest fork in the flow.
 *
 * Every track gets its own lane, so a three-way fork needs more room than a
 * two-way one. The toolbar under the list lines up on the same number.
 */
export function flowRailGutter(stages: DataFlowStage[]): number {
  const widest = stages.reduce((max, stage) => Math.max(max, stage.arms.length), 1);
  return Math.max(FLOW_STEP_RAIL_GUTTER, flowRailLaneX(widest - 1) + LANE_PAD);
}
