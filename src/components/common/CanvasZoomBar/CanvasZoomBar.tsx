import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { trackProductEvent } from '@/metrics';
import { arrangeCurrentView } from '@utils/arrangeCurrentView';
import { setArrangeUndo } from '@/state/arrangeUndo';
import { useGlassSurface } from '@theme/glassSurfaces';
import { HStack, Slider } from '@chakra-ui/react';
import { useReactFlow, useStore } from '@xyflow/react';
import { LayoutGrid, Maximize2, Waypoints } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isServiceGraphActive,
  isServiceGraphBuilding,
  subscribeServiceGraph,
  toggleServiceGraph,
} from '@/state/serviceGraph';

type Props = {
  /**
   * Only when the person may edit this diagram. A viewer or a canvas locked
   * under a panel must not offer Arrange — moves would either bounce or
   * rewrite something they cannot save.
   */
  canArrange?: boolean;
  /** After positions land, let the owner of the model know. */
  onArranged?: () => void;
  /**
   * Offer the service-graph toggle. Only the project canvas has levels to
   * flatten — the sequence editor and the embedded diagram share this bar and
   * have no model behind them to graph.
   */
  canGraph?: boolean;
};

/** Zoom chrome — slider + fit (+ graph and arrange when there is a model), same icon language as ToolsRail. */
export default function CanvasZoomBar({
  canArrange = false,
  onArranged,
  canGraph = false,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { zoomTo, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const minZoom = useStore((s) => s.minZoom);
  const maxZoom = useStore((s) => s.maxZoom);
  const graphBuilding = useSyncExternalStore(
    subscribeServiceGraph,
    isServiceGraphBuilding,
    () => false
  );
  const graphActive = useSyncExternalStore(
    subscribeServiceGraph,
    isServiceGraphActive,
    /* The graph never survives a reload, so the server render is always the
       diagram — see state/serviceGraph.ts. */
    () => false
  );

  const handleArrange = () => {
    const outcome = arrangeCurrentView();
    trackProductEvent('editor.arrange', { moved: outcome?.moved ?? 0 });
    if (outcome) {
      /* Held until the person says keep or undo. Arranging rewrites the whole
         view at once and nothing else in the editor can be taken back, so the
         one place that does needs its previous state kept somewhere the bar
         above the canvas can reach. */
      setArrangeUndo({
        moved: outcome.moved,
        viewKey: outcome.viewKey,
        revert: () => {
          outcome.revert();
          onArranged?.();
          void fitView({ padding: 0.2, duration: 380 });
        },
      });
    }
    onArranged?.();
    void fitView({ padding: 0.2, duration: 380 });
  };

  return (
    <HStack
      role="toolbar"
      aria-label={t('canvas_zoom_controls')}
      gap="6px"
      px="8px"
      py="6px"
      className="nopan nodrag"
      {...glass.floatBar}
    >
      <Slider.Root
        size="sm"
        min={minZoom}
        max={maxZoom}
        step={0.01}
        value={[zoom]}
        onValueChange={(d) => {
          const next = d.value[0];
          if (typeof next === 'number') void zoomTo(next);
        }}
        w="88px"
        colorPalette="brand"
        aria-label={[t('canvas_zoom_controls')]}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Slider.Control h="28px" display="flex" alignItems="center">
          <Slider.Track h="3px" bg="border.default" borderRadius="full">
            <Slider.Range bg="brand.emphasis" />
          </Slider.Track>
          <Slider.Thumbs
            boxSize="12px"
            bg="brand.emphasis"
            borderWidth="2px"
            borderColor="white"
            shadow="sm"
            _focusVisible={{ outline: 'none', boxShadow: '0 0 0 3px var(--chakra-colors-border-brand-emphasis)' }}
          />
        </Slider.Control>
      </Slider.Root>
      {canGraph ? (
        <ToolbarIconButton
          title={graphActive ? t('service_graph_exit') : t('service_graph')}
          aria-label={graphActive ? t('service_graph_exit') : t('service_graph')}
          active={graphActive}
          /* The wait belongs on the thing that was pressed. Framing the graph
             is no longer this button's job either: the layout is asynchronous,
             so whoever finishes building it frames it (EditorCanvasGraph). */
          loading={graphBuilding}
          onClick={() => {
            const next = toggleServiceGraph();
            trackProductEvent('editor.service_graph', { active: next });
          }}
          data-testid="canvas-service-graph"
        >
          <Waypoints size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
      ) : null}
      {/* Arrange is about the diagram's own positions. The graph's are
          computed, and arranging here would quietly rewrite the level view
          nobody is looking at. */}
      {canArrange && !graphActive ? (
        <ToolbarIconButton
          title={t('arrange_diagram')}
          aria-label={t('arrange_diagram')}
          onClick={handleArrange}
          data-testid="canvas-arrange"
        >
          <LayoutGrid size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
      ) : null}
      <ToolbarIconButton
        title={t('fit_view')}
        aria-label={t('fit_view')}
        onClick={() => void fitView({ padding: 0.2 })}
      >
        <Maximize2 size={TOOLBAR_ICON_SIZE} />
      </ToolbarIconButton>
    </HStack>
  );
}
