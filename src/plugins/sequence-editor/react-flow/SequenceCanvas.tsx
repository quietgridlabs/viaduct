import {
  Background,
  ConnectionLineType,
  ConnectionMode,
  Panel,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  getStraightPath,
  useReactFlow,
  type Connection,
  type ConnectionLineComponentProps,
  type Edge,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useColorMode } from '@contexts/ColorModeContext';
import { useGlassSurface } from '@theme/glassSurfaces';
import { CANVAS_DOT_GAP_EMBED, CANVAS_DOT_SIZE_EMBED } from '@theme/canvasSurfaces';
import CanvasZoomBar from '@components/common/CanvasZoomBar';
import { isTypingTarget } from '@utils/typingTarget';
import {
  Box,
  Button,
  Dialog,
  HStack,
  Input,
  Portal,
  Separator,
  Text,
} from '@chakra-ui/react';
import { MessageSquarePlus, Minus, StickyNote } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createId,
  type MessageItem,
  type Participant,
} from '../domain/sequence-model';
import type { C4CatalogParticipant } from '../host/c4Catalog';
import { DEFAULT_LAYOUT, laneX } from '../layout/sequence-layout';
import { useSequenceEditorStore } from '../state/sequence-editor-store';
import { participantFromCatalog } from '../ui/Toolbar';
import SearchableSelect from '@components/common/SearchableSelect';
import DividerNode from './DividerNode';
import ExpandFrameNode from './ExpandFrameNode';
import NoteNode from './NoteNode';
import ParticipantNode from './ParticipantNode';
import { projectToReactFlow, type ActivationBarData } from './projection';
import SequenceMessageEdge from './SequenceMessageEdge';

const nodeTypes = {
  sequenceParticipant: ParticipantNode,
  sequenceExpand: ExpandFrameNode,
  sequenceNote: NoteNode,
  sequenceDivider: DividerNode,
};
const edgeTypes = { sequenceMessage: SequenceMessageEdge };

function SequenceConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const { chrome } = useColorMode();
  const [path] = getStraightPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });
  const color = chrome.edgeStroke;
  return (
    <g>
      <defs>
        <marker
          id="seq-connection-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L9,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
      <path
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        d={path}
        markerEnd="url(#seq-connection-arrow)"
      />
    </g>
  );
}

function LifelinesInViewport({
  participants,
  height,
  stroke,
  activationBars,
  activationFill,
  activationStroke,
}: {
  participants: Participant[];
  height: number;
  stroke: string;
  activationBars: ActivationBarData[];
  activationFill: string;
  activationStroke: string;
}) {
  const sorted = [...participants].sort((a, b) => a.order - b.order);
  const w = DEFAULT_LAYOUT.activationWidth;
  return (
    <ViewportPortal>
      <svg
        width={Math.max(laneX(sorted.length || 1) + 200, 800)}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {sorted.map((p) => {
          const x = laneX(p.order, DEFAULT_LAYOUT);
          return (
            <line
              key={p.id}
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
      </svg>
    </ViewportPortal>
  );
}

type CtxTarget =
  | { kind: 'participant'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'expand'; id: string };

function CanvasAddBar({
  catalog,
  readOnly,
}: {
  catalog: C4CatalogParticipant[];
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  const applyCommand = useSequenceEditorStore((s) => s.applyCommand);
  const model = useSequenceEditorStore((s) => s.model);
  const selection = useSequenceEditorStore((s) => s.selection);
  const [pickKey, setPickKey] = useState(0);

  const unusedCatalog = useMemo(() => {
    const usedAliases = new Set(model.participants.map((p) => p.id));
    const usedEntities = new Set(
      model.participants.map((p) => p.c4EntityId).filter((id): id is string => Boolean(id))
    );
    // Also treat matching labels as already present (legacy participants without c4EntityId).
    const usedLabels = new Set(
      model.participants.map((p) => p.label.trim().toLowerCase())
    );
    return catalog.filter((c) => {
      if (usedAliases.has(c.id)) return false;
      if (usedEntities.has(c.c4EntityId)) return false;
      if (usedLabels.has(c.label.trim().toLowerCase())) return false;
      return true;
    });
  }, [catalog, model.participants]);

  const pickOptions = useMemo(
    () =>
      unusedCatalog.map((c) => ({
        value: c.id,
        label: c.label,
        group: c.group,
      })),
    [unusedCatalog]
  );

  const addMessage = () => {
    if (model.participants.length < 2) return;
    const [a, b] = [...model.participants].sort((x, y) => x.order - y.order);
    applyCommand(
      {
        type: 'item.add',
        index: model.items.length,
        item: addMessageBetween(a!.id, b!.id, 'message'),
      },
      'canvas'
    );
  };

  const addNote = () => {
    const participantId =
      selection?.kind === 'participant' ? selection.id : model.participants[0]?.id;
    if (!participantId) return;
    applyCommand(
      {
        type: 'item.add',
        index: model.items.length,
        item: {
          id: createId('note'),
          type: 'note',
          position: 'over',
          participantIds: [participantId],
          text: 'note',
        },
      },
      'canvas'
    );
  };

  const addDivider = () => {
    applyCommand(
      {
        type: 'item.add',
        index: model.items.length,
        item: {
          id: createId('div'),
          type: 'divider',
          text: 'section',
        },
      },
      'canvas'
    );
  };

  return (
    <Box
      bg={chrome.dialogBg}
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="10px"
      boxShadow={chrome.shadow}
      px="8px"
      py="6px"
      maxW="min(920px, calc(100vw - 48px))"
    >
      <HStack gap="8px" align="center" flexWrap="wrap">
        <SearchableSelect
          key={pickKey}
          size="sm"
          width="340px"
          options={pickOptions}
          value=""
          disabled={readOnly || unusedCatalog.length === 0}
          placeholder={
            unusedCatalog.length === 0
              ? t('sequence_catalog_empty')
              : t('sequence_pick_participant')
          }
          emptyText={t('sequence_bind_no_matches')}
          data-testid="sequence-pick-participant"
          onChange={(id) => {
            if (!id || readOnly) return;
            const item = catalog.find((c) => c.id === id);
            if (!item) return;
            applyCommand(
              {
                type: 'participant.add',
                participant: participantFromCatalog(item, model.participants.length),
              },
              'canvas'
            );
            setPickKey((k) => k + 1);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly || model.participants.length < 2}
          onClick={addMessage}
          title={t('sequence_add_message_hint')}
        >
          <MessageSquarePlus size={16} />
          {t('sequence_add_message')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly || model.participants.length === 0}
          onClick={addNote}
          title={t('sequence_add_note_hint')}
        >
          <StickyNote size={16} />
          {t('sequence_add_note')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={addDivider}
          title={t('sequence_add_divider_hint')}
        >
          <Minus size={16} />
          {t('sequence_add_divider')}
        </Button>
      </HStack>
    </Box>
  );
}

function SequenceCanvasInner({
  readOnly,
  catalog,
}: {
  readOnly?: boolean;
  catalog: C4CatalogParticipant[];
}) {
  const { t } = useTranslation();
  const { chrome, mode } = useColorMode();
  const glass = useGlassSurface();
  const model = useSequenceEditorStore((s) => s.model);
  const applyCommand = useSequenceEditorStore((s) => s.applyCommand);
  const setSelection = useSequenceEditorStore((s) => s.setSelection);
  const selection = useSequenceEditorStore((s) => s.selection);
  const collapsedExpandIds = useSequenceEditorStore((s) => s.collapsedExpandIds);
  const { fitView } = useReactFlow();
  const fitted = useRef(false);
  const collapsedKey = collapsedExpandIds.join('|');

  const [menu, setMenu] = useState<{
    target: CtxTarget;
    top: number;
    left: number;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const { nodes, edges, height, activationBars } = useMemo(() => {
    const collapsedSet = new Set(collapsedExpandIds);
    return projectToReactFlow(model, DEFAULT_LAYOUT, collapsedSet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, collapsedKey]);

  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    const id = requestAnimationFrame(() => fitView({ padding: 0.2 }));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteTarget = useCallback(
    (target: CtxTarget) => {
      if (readOnly) return;
      if (target.kind === 'participant') {
        applyCommand(
          { type: 'participant.remove', id: target.id, strategy: 'remove-references' },
          'canvas'
        );
      } else if (target.kind === 'expand' || target.kind === 'item') {
        applyCommand({ type: 'item.remove', id: target.id }, 'canvas');
      }
      setSelection(null);
      setMenu(null);
    },
    [applyCommand, readOnly, setSelection]
  );

  const deleteSelection = useCallback(() => {
    if (readOnly || !selection) return;
    deleteTarget(selection);
  }, [deleteTarget, readOnly, selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (readOnly) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selection) return;
        e.preventDefault();
        deleteSelection();
      }
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelection, readOnly, selection]);

  const openEditMessage = useCallback(
    (itemId: string) => {
      const walk = (items: typeof model.items): string | null => {
        for (const it of items) {
          if (it.id === itemId && it.type === 'message') return it.text;
          if (it.type === 'fragment') {
            for (const b of it.branches) {
              const hit = walk(b.items);
              if (hit != null) return hit;
            }
          }
        }
        return null;
      };
      setEditItemId(itemId);
      setEditText(walk(model.items) ?? 'message');
      setEditOpen(true);
      setMenu(null);
    },
    [model]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.button !== 0) return;
      if (node.id.startsWith('participant:')) {
        setSelection({ kind: 'participant', id: node.id.slice('participant:'.length) });
      } else if (node.id.startsWith('expand:')) {
        setSelection({ kind: 'expand', id: node.id.slice('expand:'.length) });
      } else if (node.id.startsWith('note:')) {
        setSelection({ kind: 'item', id: node.id.slice('note:'.length) });
      } else if (node.id.startsWith('divider:')) {
        setSelection({ kind: 'item', id: node.id.slice('divider:'.length) });
      } else if (node.id.startsWith('delay:')) {
        setSelection({ kind: 'item', id: node.id.slice('delay:'.length) });
      }
    },
    [setSelection]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (event.button !== 0) return;
      if (!edge.id.startsWith('message:')) return;
      setSelection({ kind: 'item', id: edge.id.slice('message:'.length) });
    },
    [setSelection]
  );

  const onPaneClick = useCallback(() => {
    setMenu(null);
    setSelection(null);
  }, [setSelection]);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      if (readOnly || !node.id.startsWith('participant:')) return;
      const id = node.id.replace('participant:', '');
      const toOrder = Math.round(
        (node.position.x + 80 - DEFAULT_LAYOUT.firstLaneX) / DEFAULT_LAYOUT.laneWidth
      );
      applyCommand({ type: 'participant.reorder', id, toOrder }, 'canvas');
    },
    [applyCommand, readOnly]
  );

  const onNodeDrag: OnNodeDrag = useCallback((_e, node) => {
    if (!node.id.startsWith('participant:')) return;
    node.position.y = DEFAULT_LAYOUT.headerY;
  }, []);

  const connectFromRef = useRef<string | null>(null);

  const onConnectStart = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      params: { nodeId: string | null; handleType: string | null }
    ) => {
      connectFromRef.current = params.nodeId;
    },
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      const startNodeId = connectFromRef.current;
      let fromNode = connection.source;
      let toNode = connection.target;

      if (startNodeId) {
        fromNode = startNodeId;
        if (connection.source === startNodeId) {
          toNode = connection.target;
        } else if (connection.target === startNodeId) {
          toNode = connection.source;
        }
      }

      const from = fromNode?.replace('participant:', '');
      const to = toNode?.replace('participant:', '');
      connectFromRef.current = null;
      if (!from || !to || from === to) return;
      applyCommand(
        {
          type: 'item.add',
          index: model.items.length,
          item: addMessageBetween(from, to, 'message'),
        },
        'canvas'
      );
    },
    [applyCommand, model.items.length, readOnly]
  );

  const onConnectEnd = useCallback(() => {
    connectFromRef.current = null;
  }, []);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const from = connection.source?.replace('participant:', '');
    const to = connection.target?.replace('participant:', '');
    return Boolean(from && to && from !== to);
  }, []);

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      if (readOnly || !edge.id.startsWith('message:')) return;
      const id = edge.id.replace('message:', '');
      // Context menu only — selection is left-click.
      const top = event.clientY;
      const left = event.clientX;
      requestAnimationFrame(() => {
        setMenu({ target: { kind: 'item', id }, top, left });
      });
    },
    [readOnly]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      if (readOnly) return;
      let target: CtxTarget | null = null;
      if (node.id.startsWith('participant:')) {
        target = { kind: 'participant', id: node.id.replace('participant:', '') };
      } else if (node.id.startsWith('expand:')) {
        target = { kind: 'expand', id: node.id.replace('expand:', '') };
      } else if (node.id.startsWith('note:')) {
        target = { kind: 'item', id: node.id.slice('note:'.length) };
      } else if (node.id.startsWith('divider:')) {
        target = { kind: 'item', id: node.id.slice('divider:'.length) };
      } else if (node.id.startsWith('delay:')) {
        target = { kind: 'item', id: node.id.slice('delay:'.length) };
      }
      if (!target) return;
      const top = event.clientY;
      const left = event.clientX;
      const next = target;
      requestAnimationFrame(() => {
        setMenu({ target: next, top, left });
      });
    },
    [readOnly]
  );

  // Close floating menu on outside pointerdown (not the opening contextmenu).
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest('[data-sequence-ctx-menu]')) return;
      setMenu(null);
    };
    // Next tick: ignore the same gesture that opened the menu.
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [menu]);

  const displayNodes = useMemo(() => {
    return nodes.map((n) => {
      let selected = false;
      if (selection?.kind === 'participant' && n.id.startsWith('participant:')) {
        selected = selection.id === n.id.slice('participant:'.length);
      } else if (selection?.kind === 'expand' && n.id.startsWith('expand:')) {
        selected = selection.id === n.id.slice('expand:'.length);
      } else if (selection?.kind === 'item') {
        if (n.id.startsWith('note:')) selected = selection.id === n.id.slice('note:'.length);
        else if (n.id.startsWith('divider:'))
          selected = selection.id === n.id.slice('divider:'.length);
        else if (n.id.startsWith('delay:'))
          selected = selection.id === n.id.slice('delay:'.length);
      }

      if (n.type !== 'sequenceParticipant') {
        return { ...n, selected };
      }
      const order = (n.data as { order?: number }).order ?? 0;
      return {
        ...n,
        selected,
        zIndex: 2,
        position: {
          x: laneX(order) - 80,
          y: DEFAULT_LAYOUT.headerY,
        },
      };
    });
  }, [nodes, selection]);

  const displayEdges = useMemo(() => {
    return edges.map((e) => {
      const selected =
        selection?.kind === 'item' &&
        e.id.startsWith('message:') &&
        selection.id === e.id.slice('message:'.length);
      return { ...e, selected };
    });
  }, [edges, selection]);

  const menuIsMessage =
    menu?.target.kind === 'item' &&
    Boolean(
      (() => {
        const walk = (items: typeof model.items): boolean => {
          for (const it of items) {
            if (it.id === menu.target.id && it.type === 'message') return true;
            if (it.type === 'fragment') {
              for (const b of it.branches) {
                if (walk(b.items)) return true;
              }
            }
          }
          return false;
        };
        return walk(model.items);
      })()
    );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: chrome.canvasBg,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ReactFlow
        /* See FlowCanvas: React Flow's own class overrides the Chakra palette
           for anything rendered inside the canvas. */
        colorMode={mode}
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Straight}
        connectionLineComponent={SequenceConnectionLine}
        panActivationKeyCode={null}
        deleteKeyCode={null}
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        minZoom={0.3}
        maxZoom={1.5}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          setMenu(null);
        }}
        proOptions={{ hideAttribution: true }}
        style={{ background: chrome.canvasBg }}
      >
        <Background
          gap={CANVAS_DOT_GAP_EMBED}
          size={CANVAS_DOT_SIZE_EMBED}
          color={chrome.canvasDot}
          bgColor={chrome.canvasBg}
        />
        <Panel position="top-left" style={{ margin: 12 }}>
          <CanvasAddBar catalog={catalog} readOnly={readOnly} />
        </Panel>
        <Panel position="bottom-left" style={{ margin: 12 }}>
          <CanvasZoomBar />
        </Panel>
        <LifelinesInViewport
          participants={model.participants}
          height={height}
          stroke={chrome.borderStrong}
          activationBars={activationBars}
          activationFill={`${chrome.accent}33`}
          activationStroke={chrome.accent}
        />
      </ReactFlow>

      {menu ? (
        <Box
          data-sequence-ctx-menu
          position="fixed"
          top={`${menu.top}px`}
          left={`${menu.left}px`}
          zIndex={2000}
          minW="220px"
          {...glass.menu}
          py="4px"
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menuIsMessage ? (
            <button
              type="button"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
              }}
              onClick={() => {
                if (menu.target.kind === 'item') openEditMessage(menu.target.id);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--chakra-colors-bg-list-hover, rgba(127,127,127,0.12))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Text fontWeight="600" fontSize="sm">
                {t('sequence_edit_message')}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {t('sequence_edit_message_hint')}
              </Text>
            </button>
          ) : null}
          {menuIsMessage ? (
            <Separator borderColor="border.default" my="4px" />
          ) : null}
          <button
            type="button"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
            }}
            onClick={() => deleteTarget(menu.target)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--chakra-colors-bg-list-hover, rgba(127,127,127,0.12))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Text fontWeight="600" fontSize="sm" color="red.400">
              {t('delete')}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {t('sequence_delete_element_hint')}
            </Text>
          </button>
        </Box>
      ) : null}

      <Dialog.Root
        open={editOpen}
        onOpenChange={(d) => {
          if (!d.open) setEditOpen(false);
        }}
      >
        <Portal>
          <Dialog.Backdrop bg={glass.backdrop} />
          <Dialog.Positioner>
            <Dialog.Content color="fg.default" maxW="420px" w="calc(100% - 32px)" {...glass.dialog}>
              <Dialog.Header borderBottomWidth="1px" borderColor="border.glass">
                <Dialog.Title>{t('sequence_edit_message')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Input
                  size="sm"
                  minH="32px"
                  h="32px"
                  value={editText}
                  autoFocus
                  placeholder={t('sequence_message')}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editItemId) {
                      applyCommand(
                        {
                          type: 'item.update',
                          id: editItemId,
                          patch: { text: editText } as Partial<MessageItem>,
                        },
                        'canvas'
                      );
                      setEditOpen(false);
                    }
                  }}
                />
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="sm" variant="ghost" onClick={() => setEditOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  colorPalette="brand"
                  onClick={() => {
                    if (!editItemId) return;
                    applyCommand(
                      {
                        type: 'item.update',
                        id: editItemId,
                        patch: { text: editText } as Partial<MessageItem>,
                      },
                      'canvas'
                    );
                    setEditOpen(false);
                  }}
                >
                  {t('save')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </div>
  );
}

export default function SequenceCanvas({
  readOnly,
  catalog = [],
}: {
  readOnly?: boolean;
  catalog?: C4CatalogParticipant[];
}) {
  return (
    <ReactFlowProvider>
      <SequenceCanvasInner readOnly={readOnly} catalog={catalog} />
    </ReactFlowProvider>
  );
}

export function addMessageBetween(
  from: string,
  to: string,
  text = 'message'
): MessageItem {
  return {
    id: createId('msg'),
    type: 'message',
    from,
    to,
    text,
    arrow: '->',
  };
}
