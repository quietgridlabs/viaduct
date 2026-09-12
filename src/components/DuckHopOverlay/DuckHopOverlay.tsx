import { QUACK_BUBBLE_MS, rollQuackTilt, type QuackQuip } from '@components/QuackBubble';
import {
  exitDuckHopGame,
  getDuckHopSnapshot,
  resetDuckHopGame,
  setDuckHopNode,
  startDuckHopGame,
  subscribeDuckHop,
} from '@/state/duckHopGame';
import { CANVAS_CHROME_Z } from '@theme/sidePanelLayout';
import {
  canDrillIntoNode,
  canDrillUp,
  drillUpLandingId,
  findHopNodeInDirection,
  findSpaceHopTarget,
  isPlayableHopNode,
  nodeCenter,
  nodeTopPerch,
  pickStartHopNode,
  type HopDirection,
} from '@utils/duckHopNav';
import { isTypingTarget } from '@utils/typingTarget';
import { runLevelChange } from '@/state/levelTransition';
import { useFlatC4Store, useFlatNavigation } from '@archivisio/c4-modelizer-sdk';
import { Box } from '@chakra-ui/react';
import { useEdges, useNodes, useReactFlow, useStore, type Node } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import DuckSprite from './DuckSprite';
import {
  ARROW_DIRECTIONS,
  DRILL_PLACE_DELAY_MS,
  DRILL_PLACE_RETRIES,
  DUCK_GLIDE_MS,
  HOP_QUACK_ODDS,
  QUACK_ODDS_ON_DRILL,
  QUACK_ODDS_ON_HOP,
  QUACK_ODDS_ON_REFUSAL,
  RUBBER_HOP_MS,
  TELEPORT_RETRIES,
} from './constants';
import {
  chance,
  cssEscape,
  facingForDelta,
  facingForDirection,
  nextQuackDelay,
  randomQuackLine,
} from './helpers';
import type { DuckFacing } from './types';

/**
 * Easter egg: Ctrl+Shift+Q sends the navbar duck onto the canvas to hop
 * between elements with arrows and space. Esc sends it home.
 */
export default function DuckHopOverlay() {
  const { phase, currentNodeId } = useSyncExternalStore(subscribeDuckHop, getDuckHopSnapshot);
  const nodes = useNodes();
  const edges = useEdges();
  const reactFlow = useReactFlow();
  const domNode = useStore((s) => s.domNode);
  const viewport = useStore((s) => s.transform);
  const model = useFlatC4Store((s) => s.model);
  const { navigateToSystem, navigateToContainer, navigateToComponent, navigateToCode } =
    useFlatNavigation();

  const [duckPos, setDuckPos] = useState<{ x: number; y: number } | null>(null);
  /* Whether the duck is mid-flight between perches.
     Driven by the node changing, not by the position setter: a hop also pans
     the canvas, and the follow-along that keeps her glued fires straight after
     — owning the flag there meant it was cleared before the flight began. */
  const [glide, setGlide] = useState(false);
  const duckPosRef = useRef<{ x: number; y: number } | null>(null);
  duckPosRef.current = duckPos;
  const [facing, setFacing] = useState<DuckFacing>({ flip: false, rotate: 0 });
  const [hopTick, setHopTick] = useState(0);
  const [rubberHop, setRubberHop] = useState(false);
  const [quip, setQuip] = useState<QuackQuip | null>(null);
  const lastNeighborRef = useRef<string | null>(null);
  const pendingDrillRef = useRef(false);
  const drillAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const drillLandingNodeIdRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const quipSeqRef = useRef(0);
  const quipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quipScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = phase !== 'idle';

  const clearQuipTimers = useCallback(() => {
    if (quipTimerRef.current) clearTimeout(quipTimerRef.current);
    if (quipScheduleRef.current) clearTimeout(quipScheduleRef.current);
    quipTimerRef.current = null;
    quipScheduleRef.current = null;
  }, []);

  const sayQuack = useCallback(() => {
    quipSeqRef.current += 1;
    setQuip({ id: quipSeqRef.current, text: randomQuackLine(), tilt: rollQuackTilt() });
    if (quipTimerRef.current) clearTimeout(quipTimerRef.current);
    quipTimerRef.current = setTimeout(() => setQuip(null), QUACK_BUBBLE_MS);
  }, []);

  const screenForNode = useCallback(
    (nodeId: string) => {
      const root = rootRef.current;
      if (!root || !domNode) return null;

      const nodeEl = domNode.querySelector(
        `.react-flow__node[data-id="${cssEscape(nodeId)}"]`
      ) as HTMLElement | null;
      if (nodeEl) {
        const nodeRect = nodeEl.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        return {
          x: nodeRect.left + nodeRect.width / 2 - rootRect.left,
          y: nodeRect.top - rootRect.top,
        };
      }

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const internal = reactFlow.getInternalNode(nodeId);
      const perch = nodeTopPerch(node, internal?.internals.positionAbsolute);
      const client = reactFlow.flowToScreenPosition(perch);
      const rootRect = root.getBoundingClientRect();
      return { x: client.x - rootRect.left, y: client.y - rootRect.top };
    },
    [nodes, reactFlow, domNode]
  );

  const overlayToClient = useCallback((point: { x: number; y: number }) => {
    const root = rootRef.current;
    if (!root) return point;
    const rootRect = root.getBoundingClientRect();
    return { x: point.x + rootRect.left, y: point.y + rootRect.top };
  }, []);

  const teleportToNode = useCallback(
    (nodeId: string) => {
      const target = screenForNode(nodeId);
      if (!target) return false;
      setDuckPos(target);
      return true;
    },
    [screenForNode]
  );

  const teleportToNodeRef = useRef(teleportToNode);
  teleportToNodeRef.current = teleportToNode;

  const retryTeleport = useCallback((nodeId: string, attempt = 0) => {
    if (teleportToNode(nodeId)) return;
    if (attempt < TELEPORT_RETRIES) {
      requestAnimationFrame(() => retryTeleport(nodeId, attempt + 1));
    }
  }, [teleportToNode]);

  const bounceDuck = useCallback(() => {
    setRubberHop(true);
    setHopTick((n) => n + 1);
    window.setTimeout(() => setRubberHop(false), RUBBER_HOP_MS);
  }, []);

  const drillInto = useCallback(
    (node: Node) => {
      const type = (node.data as { type?: string }).type;
      const id = node.id;
      if (duckPos) drillAnchorRef.current = { ...duckPos };
      drillLandingNodeIdRef.current = null;
      pendingDrillRef.current = true;

      runLevelChange(() => {
        if (type === 'system') {
          navigateToContainer(id);
        } else if (type === 'container' && model.activeSystemId) {
          navigateToComponent(model.activeSystemId, id);
        } else if (
          type === 'component' &&
          model.activeSystemId &&
          model.activeContainerId
        ) {
          navigateToCode(model.activeSystemId, model.activeContainerId, id);
        }
      });
    },
    [
      duckPos,
      model.activeSystemId,
      model.activeContainerId,
      navigateToContainer,
      navigateToComponent,
      navigateToCode,
    ]
  );

  const drillUp = useCallback(() => {
    if (!canDrillUp(model.viewLevel)) {
      bounceDuck();
      if (chance(QUACK_ODDS_ON_REFUSAL)) sayQuack();
      return;
    }
    const landingId = drillUpLandingId(model);
    if (!landingId) {
      bounceDuck();
      return;
    }
    if (duckPos) drillAnchorRef.current = { ...duckPos };
    drillLandingNodeIdRef.current = landingId;
    pendingDrillRef.current = true;

    runLevelChange(() => {
      if (model.viewLevel === 'code' && model.activeSystemId && model.activeContainerId) {
        navigateToComponent(model.activeSystemId, model.activeContainerId);
      } else if (model.viewLevel === 'component' && model.activeSystemId) {
        navigateToContainer(model.activeSystemId);
      } else if (model.viewLevel === 'container') {
        navigateToSystem();
      }
    });
  }, [
    duckPos,
    model,
    navigateToSystem,
    navigateToContainer,
    navigateToComponent,
    bounceDuck,
    sayQuack,
  ]);

  const beginGame = useCallback(() => {
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const start = pickStartHopNode(nodes, center);
    if (!start) return;

    lastNeighborRef.current = null;
    setFacing({ flip: false, rotate: 0 });
    startDuckHopGame(start.id);
  }, [nodes, reactFlow]);

  /* Teleport onto the start node once the overlay portal is mounted. */
  useEffect(() => {
    if (!active || !currentNodeId || !domNode) return;
    if (pendingDrillRef.current) return;
    retryTeleport(currentNodeId);
  }, [active, currentNodeId, domNode, retryTeleport]);

  /* Fly, rather than blink, from one perch to the next. */
  const perchedOnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentNodeId) {
      perchedOnRef.current = null;
      return;
    }
    const previous = perchedOnRef.current;
    perchedOnRef.current = currentNodeId;
    /* Nothing to travel from on the first perch — she would swoop in from the
       corner of the screen. */
    if (!previous || previous === currentNodeId || !duckPosRef.current) return;
    setGlide(true);
    const timer = window.setTimeout(() => setGlide(false), DUCK_GLIDE_MS + 40);
    return () => window.clearTimeout(timer);
  }, [currentNodeId]);

  /* Stay glued while panning/zooming. */
  useEffect(() => {
    if (phase !== 'playing' || !currentNodeId || pendingDrillRef.current) return;
    teleportToNodeRef.current(currentNodeId);
  }, [viewport, phase, currentNodeId, nodes]);

  useEffect(() => {
    if (!pendingDrillRef.current || phase !== 'playing') return;
    if (nodes.filter(isPlayableHopNode).length === 0) return;

    let cancelled = false;

    const finishDrill = (attempt = 0) => {
      if (cancelled || !pendingDrillRef.current) return;

      const anchor = drillAnchorRef.current;
      const landingId = drillLandingNodeIdRef.current;
      const flowPoint = anchor
        ? reactFlow.screenToFlowPosition(overlayToClient(anchor))
        : reactFlow.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
      const preferred = landingId ? nodes.find((n) => n.id === landingId) : null;
      const start = preferred ?? pickStartHopNode(nodes, flowPoint);
      if (!start) return;

      const placed = teleportToNode(start.id);
      if (!placed && attempt < DRILL_PLACE_RETRIES) {
        requestAnimationFrame(() => finishDrill(attempt + 1));
        return;
      }
      if (!placed) return;

      pendingDrillRef.current = false;
      drillAnchorRef.current = null;
      drillLandingNodeIdRef.current = null;
      lastNeighborRef.current = null;
      bounceDuck();
      if (chance(QUACK_ODDS_ON_DRILL)) sayQuack();
      setDuckHopNode(start.id);
    };

    const timer = window.setTimeout(() => finishDrill(0), DRILL_PLACE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [nodes, phase, model.viewLevel, reactFlow, teleportToNode, bounceDuck, sayQuack, overlayToClient]);

  useEffect(() => {
    if (phase !== 'playing') {
      clearQuipTimers();
      setQuip(null);
      return;
    }

    let cancelled = false;

    const schedule = () => {
      quipScheduleRef.current = setTimeout(() => {
        if (cancelled || getDuckHopSnapshot().phase !== 'playing') return;
        if (chance(HOP_QUACK_ODDS)) sayQuack();
        schedule();
      }, nextQuackDelay());
    };

    schedule();
    return () => {
      cancelled = true;
      clearQuipTimers();
    };
  }, [phase, sayQuack, clearQuipTimers]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        if (getDuckHopSnapshot().phase === 'idle') beginGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beginGame]);

  const hopTo = useCallback(
    (nodeId: string, direction?: HopDirection) => {
      if (!teleportToNode(nodeId)) return;
      if (direction) {
        setFacing((prev) => facingForDirection(direction, prev));
      }
      bounceDuck();
      if (chance(QUACK_ODDS_ON_HOP)) sayQuack();
      setDuckHopNode(nodeId);
    },
    [teleportToNode, sayQuack, bounceDuck]
  );

  useEffect(() => {
    if (phase !== 'playing') return;

    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        exitDuckHopGame();
        return;
      }

      if (pendingDrillRef.current || !currentNodeId) return;

      let current = nodes.find((n) => n.id === currentNodeId);
      if (!current && duckPos) {
        const flowPoint = reactFlow.screenToFlowPosition(overlayToClient(duckPos));
        const recovered = pickStartHopNode(nodes, flowPoint);
        if (recovered) {
          current = recovered;
          setDuckHopNode(recovered.id);
          teleportToNode(recovered.id);
        }
      }
      if (!current) return;

      const direction = ARROW_DIRECTIONS[event.key];
      if (direction) {
        event.preventDefault();
        const next = findHopNodeInDirection(nodes, current, direction);
        if (next) hopTo(next.id, direction);
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        const next = findSpaceHopTarget(nodes, edges, current.id, lastNeighborRef.current);
        if (!next || next.id === current.id) {
          bounceDuck();
          return;
        }
        lastNeighborRef.current = next.id;
        const cur = nodeCenter(current);
        const nxt = nodeCenter(next);
        setFacing((prev) => facingForDelta(nxt.x - cur.x, prev));
        hopTo(next.id);
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        drillUp();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!canDrillIntoNode(current, model.viewLevel)) {
          bounceDuck();
          if (chance(QUACK_ODDS_ON_REFUSAL)) sayQuack();
          return;
        }
        drillInto(current);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    phase,
    currentNodeId,
    nodes,
    edges,
    hopTo,
    duckPos,
    model.viewLevel,
    drillInto,
    drillUp,
    bounceDuck,
    sayQuack,
    reactFlow,
    teleportToNode,
    overlayToClient,
  ]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    resetDuckHopGame();
    setDuckPos(null);
  }, [phase]);

  useEffect(() => {
    if (!active) {
      setDuckPos(null);
      setQuip(null);
      clearQuipTimers();
      lastNeighborRef.current = null;
      pendingDrillRef.current = false;
      drillLandingNodeIdRef.current = null;
      drillAnchorRef.current = null;
    }
  }, [active, clearQuipTimers]);

  if (!active || !domNode) return null;

  return createPortal(
    <Box
      ref={rootRef}
      position="absolute"
      inset={0}
      zIndex={CANVAS_CHROME_Z + 20}
      pointerEvents="none"
      overflow="visible"
      aria-hidden
    >
      {duckPos ? (
        <DuckSprite
          at={duckPos}
          facing={facing}
          glide={glide}
          hopTick={hopTick}
          rubberHop={rubberHop}
          phase={phase}
          quip={quip}
        />
      ) : null}
    </Box>,
    domNode
  );
}
