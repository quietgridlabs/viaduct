import { useFlatC4Store, useFlatModelActions } from '@archivisio/c4-modelizer-sdk';
import { useAuth } from '@contexts/AuthContext';
import { trackProductEvent } from '@/metrics';
import { stampAuditCreate } from '@utils/audit';
import { viewportCenterFlowPosition } from '@utils/flowViewport';
import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

/** What was added, in fixed vocabulary: the special block or the plain level. */
function elementKind(properties: Record<string, unknown>, viewLevel: string): string {
  const kind = properties.kind;
  if (typeof kind === 'string' && kind) return kind;
  if (Array.isArray(properties.columns)) return 'table';
  return viewLevel;
}

/**
 * addElement / empty-add helpers that place new nodes at the visible viewport center.
 * Must be used under ReactFlowProvider.
 */
export function useAddElementInView() {
  const { addElement } = useFlatModelActions();
  const { screenToFlowPosition } = useReactFlow();
  const { user } = useAuth();
  const viewLevel = useFlatC4Store((s) => s.model.viewLevel);

  const addElementInView = useCallback(
    (
      properties: Record<string, unknown> = {},
      labels?: {
        system?: string;
        container?: string;
        component?: string;
        code?: string;
      }
    ) => {
      const position =
        (properties.position as { x: number; y: number } | undefined) ??
        viewportCenterFlowPosition(screenToFlowPosition);
      addElement({ ...stampAuditCreate(user), ...properties, position }, labels);
      /* Every add on the canvas comes through here, so this is the one place
         the metric belongs. `kind` distinguishes the special blocks (endpoint,
         ER table, person) from a plain element at this level — both are fixed
         vocabulary, never a name the user typed. */
      trackProductEvent('editor.element_added', {
        level: viewLevel,
        kind: elementKind(properties, viewLevel),
      });
    },
    [addElement, screenToFlowPosition, user, viewLevel]
  );

  const handleAddElementInView = useCallback(() => {
    addElementInView();
  }, [addElementInView]);

  return { addElementInView, handleAddElementInView };
}
