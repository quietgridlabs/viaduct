import { MAGIC_FLOW_FG, MAGIC_FLOW_SELECTED } from '@components/data-flow/MagicFlowMark';
import type { DataFlowStep, FlowBranchKind } from '@/types/c4Extensions';
import { flowStepNumberLabel, type DataFlowStage } from '@utils/dataFlows';
import {
  FLOW_STEP_RAIL_MAIN_X,
  flowRailGutter,
  flowRailLaneX,
} from '@components/data-flow/FlowRailLayout';
import { Box, Button, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { CornerDownRight, Link2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MAIN_X = FLOW_STEP_RAIL_MAIN_X;
const LINE_W = 2;
const NODE = 9;
const MAIN_STROKE = 'rgba(167, 139, 250, 0.75)';
/** AND / fan-out */
const PARALLEL_STROKE = '#2dd4bf';
/** OR / exclusive choice */
const ALTERNATIVE_STROKE = '#f59e0b';
/** Link step → another Magic flow */
const LINK_STROKE = '#5b8def';
const LINK_SELECTED = 'rgba(91, 141, 239, 0.16)';
const LINK_IDLE_BORDER = 'rgba(91, 141, 239, 0.45)';

function branchStroke(kind: FlowBranchKind): string {
  return kind === 'alternative' ? ALTERNATIVE_STROKE : PARALLEL_STROKE;
}

type Row = {
  step: DataFlowStep;
  stage: DataFlowStage;
  armIndex: number;
  firstInArm: boolean;
  lastInArm: boolean;
  lastInStage: boolean;
  label: string;
};

function buildRows(stages: DataFlowStage[], steps: DataFlowStep[]): Row[] {
  return stages.flatMap((stage) =>
    stage.arms.flatMap((arm, armIndex) =>
      arm.steps.map((step, posInArm) => ({
        step,
        stage,
        armIndex,
        firstInArm: posInArm === 0,
        lastInArm: posInArm === arm.steps.length - 1,
        lastInStage:
          armIndex === stage.arms.length - 1 && posInArm === arm.steps.length - 1,
        label: flowStepNumberLabel(steps, step.id),
      }))
    )
  );
}

type Props = {
  stages: DataFlowStage[];
  steps: DataFlowStep[];
  selectedStepId: string | null;
  onSelect: (stepId: string) => void;
  canWrite?: boolean;
  /** Open another track beside this one. */
  onAddBranch?: (stepId: string, kind: FlowBranchKind) => void;
  /** Carry this track on with one more step. */
  onAddStepToArm?: (stepId: string) => void;
};

export default function FlowStepGraph({
  stages,
  steps,
  selectedStepId,
  onSelect,
  canWrite,
  onAddBranch,
  onAddStepToArm,
}: Props) {
  const { t } = useTranslation();
  const rows = buildRows(stages, steps);
  const gutter = flowRailGutter(stages);

  return (
    <VStack align="stretch" gap="0" mb="0">
      {rows.map((row, i) => {
        const selected = selectedStepId === row.step.id;
        const isLink = row.step.kind === 'link';
        const branched = row.stage.branched;
        const stroke = branchStroke(row.stage.kind);
        const borderColor = isLink
          ? selected
            ? LINK_STROKE
            : LINK_IDLE_BORDER
          : selected
            ? branched
              ? stroke
              : MAGIC_FLOW_FG
            : 'border.glass';
        const bg = isLink
          ? selected
            ? LINK_SELECTED
            : 'transparent'
          : selected
            ? branched
              ? row.stage.kind === 'alternative'
                ? 'rgba(245, 158, 11, 0.16)'
                : 'rgba(45, 212, 191, 0.16)'
              : MAGIC_FLOW_SELECTED
            : 'transparent';
        const accentColor = isLink ? LINK_STROKE : branched ? stroke : 'fg.muted';
        return (
          <HStack
            key={row.step.id}
            align="stretch"
            gap="8px"
            minH="46px"
            cursor="pointer"
            onClick={() => onSelect(row.step.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(row.step.id);
              }
            }}
          >
            <GraphRail
              gutter={gutter}
              laneX={branched ? flowRailLaneX(row.armIndex) : null}
              kind={row.stage.kind}
              first={i === 0}
              last={i === rows.length - 1}
              firstInArm={row.firstInArm}
              lastInArm={row.lastInArm}
              selected={selected}
              link={isLink}
            />
            <HStack
              flex="1"
              minW={0}
              my="4px"
              px="10px"
              py="7px"
              borderRadius="8px"
              borderWidth="1px"
              borderColor={borderColor}
              bg={bg}
              transition="border-color 0.12s ease, background 0.12s ease"
            >
              <Text
                fontSize="xs"
                color={accentColor}
                w="36px"
                flexShrink={0}
                fontFamily="mono"
                fontWeight="600"
              >
                {row.label}
              </Text>
              {isLink ? (
                <Box as="span" color={LINK_STROKE} display="inline-flex" flexShrink={0} lineHeight={0}>
                  <Link2 size={13} />
                </Box>
              ) : null}
              <Text
                fontSize="sm"
                flex="1"
                lineClamp={1}
                color={isLink ? LINK_STROKE : undefined}
                fontWeight={isLink ? '600' : undefined}
              >
                {isLink
                  ? row.step.nextFlowRef?.name || t('data_flow_link_step_missing')
                  : row.step.name || t('data_flow_unnamed_step')}
              </Text>
              {canWrite && branched && row.lastInArm && onAddStepToArm ? (
                <IconButton
                  size="xs"
                  variant="ghost"
                  color={stroke}
                  flexShrink={0}
                  aria-label={t('data_flow_add_step_to_branch')}
                  title={t('data_flow_add_step_to_branch')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddStepToArm(row.step.id);
                  }}
                >
                  <CornerDownRight size={12} />
                </IconButton>
              ) : null}
              {canWrite && row.lastInStage && branched && onAddBranch ? (
                <Button
                  size="xs"
                  variant="ghost"
                  color={stroke}
                  flexShrink={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddBranch(row.step.id, row.stage.kind);
                  }}
                >
                  <Plus size={12} />
                  {t(
                    row.stage.kind === 'alternative'
                      ? 'data_flow_add_alternative'
                      : 'data_flow_add_parallel'
                  )}
                </Button>
              ) : null}
            </HStack>
          </HStack>
        );
      })}
    </VStack>
  );
}

/**
 * One row of the rail.
 *
 * The trunk runs the whole height. A track hangs off it in its own lane, tied
 * back to the trunk by a short connector at the row it starts on and the row it
 * ends on — so a fork reads as tracks leaving the trunk and rejoining it, and a
 * track that runs three steps simply stays out for three rows.
 */
function GraphRail({
  gutter,
  laneX,
  kind,
  first,
  last,
  firstInArm,
  lastInArm,
  selected,
  link,
}: {
  gutter: number;
  /** Null when the step is on the trunk rather than in a fork. */
  laneX: number | null;
  kind: FlowBranchKind;
  first: boolean;
  last: boolean;
  firstInArm: boolean;
  lastInArm: boolean;
  selected: boolean;
  link?: boolean;
}) {
  const onBranch = laneX != null;
  const stroke = branchStroke(kind);
  const nodeX = onBranch ? laneX : MAIN_X;
  const nodeColor = link ? LINK_STROKE : onBranch ? stroke : MAGIC_FLOW_FG;

  return (
    <Box w={`${gutter}px`} flexShrink={0} position="relative" alignSelf="stretch" aria-hidden>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${gutter} 100`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      >
        {!first ? (
          <line
            x1={MAIN_X}
            y1="0"
            x2={MAIN_X}
            y2="50"
            stroke={MAIN_STROKE}
            strokeWidth={LINE_W}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {!last ? (
          <line
            x1={MAIN_X}
            y1="50"
            x2={MAIN_X}
            y2="100"
            stroke={MAIN_STROKE}
            strokeWidth={LINE_W}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {onBranch && !firstInArm ? (
          <line
            x1={laneX}
            y1="0"
            x2={laneX}
            y2="50"
            stroke={stroke}
            strokeWidth={LINE_W}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {onBranch && !lastInArm ? (
          <line
            x1={laneX}
            y1="50"
            x2={laneX}
            y2="100"
            stroke={stroke}
            strokeWidth={LINE_W}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {onBranch && firstInArm ? (
          <path
            d={`M ${MAIN_X} 50 L ${laneX} 50`}
            fill="none"
            stroke={stroke}
            strokeWidth={LINE_W}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {onBranch && lastInArm && !firstInArm ? (
          <path
            d={`M ${laneX} 50 L ${MAIN_X} 50`}
            fill="none"
            stroke={stroke}
            strokeWidth={LINE_W}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <Box
        position="absolute"
        left={`${nodeX}px`}
        top="50%"
        w={`${NODE}px`}
        h={`${NODE}px`}
        transform="translate(-50%, -50%)"
        borderRadius="full"
        borderWidth="2px"
        borderColor={nodeColor}
        bg={selected ? nodeColor : 'bg.canvas'}
        boxShadow={selected ? `0 0 8px ${nodeColor}` : 'none'}
        zIndex={1}
      />
    </Box>
  );
}
