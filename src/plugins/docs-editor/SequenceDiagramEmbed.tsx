import { useColorMode } from '@contexts/ColorModeContext';
import CanvasZoomBar from '@components/common/CanvasZoomBar';
import { CANVAS_DOT_GAP_EMBED, CANVAS_DOT_SIZE_EMBED } from '@theme/canvasSurfaces';
import { Box, Button, Dialog, HStack, Portal, Text } from '@chakra-ui/react';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { useGlassSurface } from '@theme/glassSurfaces';
import {
  Background,
  ConnectionMode,
  Panel,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Participant } from '@plugins/sequence-editor/domain/sequence-model';
import { parsePlantUmlSequence } from '@plugins/sequence-editor/plantuml/parser';
import {
  DEFAULT_LAYOUT,
  laneX,
} from '@plugins/sequence-editor/layout/sequence-layout';
import DividerNode from '@plugins/sequence-editor/react-flow/DividerNode';
import ExpandFrameNode from '@plugins/sequence-editor/react-flow/ExpandFrameNode';
import NoteNode from '@plugins/sequence-editor/react-flow/NoteNode';
import ParticipantNode from '@plugins/sequence-editor/react-flow/ParticipantNode';
import {
  projectToReactFlow,
  type ActivationBarData,
} from '@plugins/sequence-editor/react-flow/projection';

const nodeTypes = {
  sequenceParticipant: ParticipantNode,
  sequenceExpand: ExpandFrameNode,
  sequenceNote: NoteNode,
  sequenceDivider: DividerNode,
};

type Props = {
  name?: string;
  plantUmlSource?: string;
  missing?: boolean;
  onOpen?: () => void;
};

type MessageDraw = {
  id: string;
  text: string;
  arrow: string;
  y: number;
  fromOrder: number;
  toOrder: number;
  isReturn: boolean;
};

function FitOnce({ nodesKey }: { nodesKey: string }) {
  const { fitView } = useReactFlow();
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!nodesKey || fittedFor.current === nodesKey) return;
    fittedFor.current = nodesKey;
    const id = requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1 }));
    return () => cancelAnimationFrame(id);
  }, [fitView, nodesKey]);
  return null;
}

function arrowHeadPoints(fromX: number, toX: number, y: number): string {
  const dir = toX >= fromX ? 1 : -1;
  const tipX = toX;
  return `${tipX},${y} ${tipX - 10 * dir},${y - 4} ${tipX - 10 * dir},${y + 4}`;
}

function DiagramOverlay({
  participants,
  height,
  stroke,
  activationBars,
  activationFill,
  activationStroke,
  messages,
  messageStroke,
  labelBg,
  labelColor,
}: {
  participants: Participant[];
  height: number;
  stroke: string;
  activationBars: ActivationBarData[];
  activationFill: string;
  activationStroke: string;
  messages: MessageDraw[];
  messageStroke: string;
  labelBg: string;
  labelColor: string;
}) {
  const sorted = [...participants].sort((a, b) => a.order - b.order);
  const w = DEFAULT_LAYOUT.activationWidth;
  const svgW = Math.max(laneX(Math.max(sorted.length, 1) - 1) + 200, 800);

  return (
    <ViewportPortal>
      <svg
        width={svgW}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          // Above expand frames (zIndex 0) so message arrows stay visible.
          zIndex: 5,
        }}
      >
        {sorted.map((p) => {
          const x = laneX(p.order, DEFAULT_LAYOUT);
          return (
            <line
              key={`life-${p.id}`}
              x1={x}
              y1={DEFAULT_LAYOUT.headerY + DEFAULT_LAYOUT.headerHeight}
              x2={x}
              y2={height}
              stroke={stroke}
              strokeWidth={1.5}
              strokeDasharray="4 6"
            />
          );
        })}
        {activationBars.map((bar, i) => {
          const x = laneX(bar.order, DEFAULT_LAYOUT) - w / 2;
          return (
            <rect
              key={`${bar.participantId}-${i}-${bar.top}`}
              x={x}
              y={bar.top}
              width={w}
              height={bar.height}
              rx={3}
              fill={activationFill}
              stroke={activationStroke}
              strokeWidth={1}
            />
          );
        })}
        {messages.map((msg) => {
          const fromX = laneX(msg.fromOrder, DEFAULT_LAYOUT);
          const toX = laneX(msg.toOrder, DEFAULT_LAYOUT);
          const dashed = msg.arrow.startsWith('--');
          const midX = (fromX + toX) / 2;
          const label = msg.isReturn ? `↩ ${msg.text || 'return'}` : msg.text || '—';
          return (
            <g key={msg.id}>
              <line
                x1={fromX}
                y1={msg.y}
                x2={toX}
                y2={msg.y}
                stroke={messageStroke}
                strokeWidth={1.75}
                strokeDasharray={dashed ? '6 4' : undefined}
              />
              <polygon
                points={arrowHeadPoints(fromX, toX, msg.y)}
                fill={messageStroke}
              />
              <rect
                x={midX - Math.min(label.length * 3.2 + 8, 90)}
                y={msg.y - 18}
                width={Math.min(label.length * 6.4 + 16, 180)}
                height={16}
                rx={3}
                fill={labelBg}
              />
              <text
                x={midX}
                y={msg.y - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={labelColor}
              >
                {label.length > 28 ? `${label.slice(0, 27)}…` : label}
              </text>
            </g>
          );
        })}
      </svg>
    </ViewportPortal>
  );
}

function EmbedCanvas({ source, fill = false }: { source: string; fill?: boolean }) {
  const { chrome, mode } = useColorMode();
  /* The preview is outside the editor's store, so the frames it draws fold
     against this instead — otherwise every group stays open forever. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggleCollapsed = useCallback((fragmentId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(fragmentId)) next.delete(fragmentId);
      else next.add(fragmentId);
      return next;
    });
  }, []);

  /* Parsed once per diagram, on purpose: the parser mints a fresh random id for
     every fragment it reads, so re-parsing on each fold would leave the id of
     the folded group pointing at nothing. */
  const parsed = useMemo(
    () => parsePlantUmlSequence(source, { strictParticipants: false }),
    [source]
  );

  useEffect(() => {
    setCollapsed(new Set());
  }, [parsed]);

  const projected = useMemo(() => {
    if (!parsed.ok) {
      return {
        nodes: [] as Node[],
        edges: [] as Edge[],
        height: 220,
        activationBars: [] as ActivationBarData[],
        participants: [] as Participant[],
        messages: [] as MessageDraw[],
        error: true,
      };
    }
    const result = projectToReactFlow(parsed.model, DEFAULT_LAYOUT, collapsed);
    const messages: MessageDraw[] = result.edges
      .filter((e) => e.type === 'sequenceMessage')
      .map((e) => {
        const d = (e.data || {}) as {
          text?: string;
          arrow?: string;
          y?: number;
          fromOrder?: number;
          toOrder?: number;
          isReturn?: boolean;
        };
        return {
          id: e.id,
          text: d.text || '',
          arrow: d.arrow || '->',
          y: d.y ?? 160,
          fromOrder: d.fromOrder ?? 0,
          toOrder: d.toOrder ?? 0,
          isReturn: Boolean(d.isReturn),
        };
      });
    return {
      ...result,
      nodes: result.nodes.map((node) =>
        node.type === 'sequenceExpand'
          ? { ...node, data: { ...node.data, onToggle: toggleCollapsed } }
          : node
      ),
      participants: parsed.model.participants,
      messages,
      error: false,
    };
  }, [parsed, collapsed, toggleCollapsed]);

  if (projected.error) {
    return (
      <Box p="12px" fontSize="sm" color="fg.muted">
        Could not render sequence diagram
      </Box>
    );
  }

  /* Inline the diagram gets a capped strip; expanded it gets the window. */
  const canvasHeight = Math.min(Math.max(projected.height, 240), 480);
  /* Keyed by the diagram, not by what is folded: collapsing a group should not
     yank the viewport back to a fresh fit. */
  const nodesKey = source;

  return (
    <Box
      h={fill ? '100%' : `${canvasHeight}px`}
      w="100%"
      bg={chrome.canvasBg}
      position="relative"
      css={{
        '& .react-flow__node': { pointerEvents: 'none' },
        '& .react-flow__controls': { pointerEvents: 'auto' },
        '& .react-flow__pane.draggable': { cursor: 'default' },
        '& .react-flow__pane.dragging': { cursor: 'grabbing' },
      }}
    >
      <ReactFlow
        colorMode={mode}
        nodes={projected.nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        connectionMode={ConnectionMode.Loose}
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        preventScrolling
        onPaneContextMenu={(e) => e.preventDefault()}
        // Must not steal Space/Backspace from the docs Monaco editor (window-level listeners).
        panActivationKeyCode={null}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: chrome.canvasBg }}
      >
        <Background
          gap={CANVAS_DOT_GAP_EMBED}
          size={CANVAS_DOT_SIZE_EMBED}
          color={chrome.canvasDot}
          bgColor={chrome.canvasBg}
        />
        <Panel position="bottom-left" style={{ margin: 8 }}>
          <CanvasZoomBar />
        </Panel>
        <DiagramOverlay
          participants={projected.participants}
          height={projected.height}
          stroke={chrome.borderStrong}
          activationBars={projected.activationBars}
          activationFill={`${chrome.accent}33`}
          activationStroke={chrome.accent}
          messages={projected.messages}
          messageStroke={chrome.edgeStroke}
          labelBg={chrome.dialogBg}
          labelColor={chrome.nodeText}
        />
        <FitOnce nodesKey={nodesKey} />
      </ReactFlow>
    </Box>
  );
}

/** Read-only live preview of a sequence diagram referenced from documentation. */
export default function SequenceDiagramEmbed({ name, plantUmlSource, missing, onOpen }: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [expanded, setExpanded] = useState(false);
  const renderable = !missing && Boolean(plantUmlSource);

  return (
    <Box
      my="10px"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="8px"
      overflow="hidden"
      bg="bg.dialog"
    >
      <HStack
        px="10px"
        py="6px"
        borderBottomWidth="1px"
        borderColor="border.default"
        justify="space-between"
        gap="8px"
      >
        <Text fontSize="xs" fontWeight="600" color="fg.default" truncate>
          {name || t('sequence_diagrams')}
        </Text>
        <HStack gap="2px" flexShrink={0}>
          {renderable ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setExpanded(true)}
              title={t('sequence_expand')}
              aria-label={t('sequence_expand')}
              data-testid="sequence-embed-expand"
            >
              <Maximize2 size={12} />
              {t('sequence_expand')}
            </Button>
          ) : null}
          {onOpen && !missing ? (
            <Button size="xs" variant="ghost" onClick={onOpen}>
              <ExternalLink size={12} />
              {t('sequence_open_editor')}
            </Button>
          ) : null}
        </HStack>
      </HStack>
      {!renderable ? (
        <Box p="12px" fontSize="sm" color="fg.muted">
          {t('documentation_sequence_missing')}
        </Box>
      ) : (
        <ReactFlowProvider>
          <EmbedCanvas source={plantUmlSource as string} />
        </ReactFlowProvider>
      )}

      {/* Full-screen read of the same diagram: a long flow is unreadable in a
          480px strip, and both the docs embed and a magic flow's attachment
          come through here. */}
      <Dialog.Root
        open={expanded}
        onOpenChange={(d) => {
          if (!d.open) setExpanded(false);
        }}
        placement="center"
        size="xl"
      >
        <Portal>
          <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
          <Dialog.Positioner zIndex={1800}>
            <Dialog.Content
              data-testid="sequence-embed-dialog"
              color="fg.default"
              maxW="calc(100vw - 32px)"
              w="1400px"
              h="calc(100dvh - 40px)"
              display="flex"
              flexDirection="column"
              {...glass.dialog}
            >
              <HStack
                px="14px"
                py="10px"
                borderBottomWidth="1px"
                borderColor="border.default"
                justify="space-between"
                gap="8px"
                flexShrink={0}
              >
                <Text fontSize="sm" fontWeight="600" truncate>
                  {name || t('sequence_diagrams')}
                </Text>
                <HStack gap="4px">
                  {onOpen ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setExpanded(false);
                        onOpen();
                      }}
                    >
                      <ExternalLink size={12} />
                      {t('sequence_open_editor')}
                    </Button>
                  ) : null}
                  <ToolbarIconButton
                    onClick={() => setExpanded(false)}
                    aria-label={t('close')}
                    title={t('close')}
                    data-testid="sequence-embed-collapse"
                  >
                    <X size={TOOLBAR_ICON_SIZE} />
                  </ToolbarIconButton>
                </HStack>
              </HStack>
              <Box flex="1" minH={0}>
                {expanded ? (
                  <ReactFlowProvider>
                    <EmbedCanvas source={plantUmlSource as string} fill />
                  </ReactFlowProvider>
                ) : null}
              </Box>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
