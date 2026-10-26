import { trackProductEvent } from '@/metrics';
import { setArrangeUndo } from '@/state/arrangeUndo';
import {
  isServiceGraphActive,
  toggleServiceGraph,
} from '@/state/serviceGraph';
import { arrangeCurrentView } from '@utils/arrangeCurrentView';
import { isTypingTarget } from '@utils/typingTarget';
import type { ReactFlowInstance } from '@xyflow/react';
import { useEffect } from 'react';
import {
  closeCanvasShortcuts,
  isCanvasShortcutsOpen,
  openCanvasShortcuts,
} from './shortcutsModal';

type Options = {
  reactFlowInstance: ReactFlowInstance;
  /** Overlay / manager covering the canvas — stand down. */
  disabled?: boolean;
  canArrange?: boolean;
  canGraph?: boolean;
  onArranged?: () => void;
};

/**
 * Canvas chords that need Ctrl/⌘. Matched on `event.code` (physical key) so a
 * Russian layout still fires KeyZ as undo, not as «я». Copy/paste live in
 * useDiagramClipboard; Delete stays in FlowCanvas.
 */
export function useCanvasShortcuts({
  reactFlowInstance,
  disabled = false,
  canArrange = false,
  canGraph = false,
  onArranged,
}: Options): void {
  useEffect(() => {
    if (disabled) return;

    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (isCanvasShortcutsOpen()) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCanvasShortcuts();
        }
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;

      const { code } = event;

      if (code === 'Equal' || code === 'NumpadAdd') {
        event.preventDefault();
        void reactFlowInstance.zoomIn({ duration: 200 });
        return;
      }
      if (code === 'Minus' || code === 'NumpadSubtract') {
        event.preventDefault();
        void reactFlowInstance.zoomOut({ duration: 200 });
        return;
      }
      if (code === 'Digit0' || code === 'Numpad0') {
        event.preventDefault();
        void reactFlowInstance.fitView({ padding: 0.2, duration: 380 });
        return;
      }
      if (code === 'Slash') {
        event.preventDefault();
        openCanvasShortcuts();
        return;
      }
      /* Ctrl+Shift+A — bare Ctrl+A is select-all in the browser. */
      if (code === 'KeyA' && event.shiftKey && canArrange && !isServiceGraphActive()) {
        event.preventDefault();
        const outcome = arrangeCurrentView();
        trackProductEvent('editor.arrange', { moved: outcome?.moved ?? 0, via: 'shortcut' });
        if (outcome) {
          setArrangeUndo({
            moved: outcome.moved,
            viewKey: outcome.viewKey,
            revert: () => {
              outcome.revert();
              onArranged?.();
              void reactFlowInstance.fitView({ padding: 0.2, duration: 380 });
            },
          });
        }
        onArranged?.();
        void reactFlowInstance.fitView({ padding: 0.2, duration: 380 });
        return;
      }
      if (code === 'KeyG' && !event.shiftKey && canGraph) {
        event.preventDefault();
        const next = toggleServiceGraph();
        trackProductEvent('editor.service_graph', { active: next, via: 'shortcut' });
      }
    };

    /* Capture: beat anything on the pane that stops bubbling. */
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [disabled, canArrange, canGraph, onArranged, reactFlowInstance]);
}
