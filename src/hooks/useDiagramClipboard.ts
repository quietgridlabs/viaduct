import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { useAuth } from '@contexts/AuthContext';
import { stampAuditCreate } from '@utils/audit';
import {
  buildClipboardPayload,
  buildPastePlan,
  isEditableKeyboardTarget,
  layerLabel,
  parseClipboardPayload,
  type DiagramClipboardPayload,
} from '@utils/diagramClipboard';
import { useCallback, useEffect, useRef } from 'react';

type Options = {
  enabled?: boolean;
  canPaste?: boolean;
  getSelectedIds: () => string[];
  onNotice?: (message: string) => void;
};

let memoryClipboard: DiagramClipboardPayload | null = null;

export function useDiagramClipboard({
  enabled = true,
  canPaste = true,
  getSelectedIds,
  onNotice,
}: Options) {
  const pasteGenerationRef = useRef(0);
  const model = useFlatC4Store((s) => s.model);
  const addSystem = useFlatC4Store((s) => s.addSystem);
  const addContainer = useFlatC4Store((s) => s.addContainer);
  const addComponent = useFlatC4Store((s) => s.addComponent);
  const addCodeElement = useFlatC4Store((s) => s.addCodeElement);
  const connectSystems = useFlatC4Store((s) => s.connectSystems);
  const connectContainers = useFlatC4Store((s) => s.connectContainers);
  const connectComponents = useFlatC4Store((s) => s.connectComponents);
  const connectCodeElements = useFlatC4Store((s) => s.connectCodeElements);
  const updateSystem = useFlatC4Store((s) => s.updateSystem);
  const updateContainer = useFlatC4Store((s) => s.updateContainer);
  const updateComponent = useFlatC4Store((s) => s.updateComponent);
  const { user } = useAuth();

  const copy = useCallback(() => {
    const payload = buildClipboardPayload(model, getSelectedIds());
    if (!payload) return false;
    memoryClipboard = payload;
    pasteGenerationRef.current = 0;
    void navigator.clipboard?.writeText(JSON.stringify(payload)).catch(() => {
      /* memory clipboard is enough */
    });
    onNotice?.(
      `Copied ${payload.elements.length} ${layerLabel(payload.viewLevel)} element(s)`
    );
    return true;
  }, [model, getSelectedIds, onNotice]);

  const applyPaste = useCallback(
    (payload: DiagramClipboardPayload) => {
      if (!canPaste) {
        onNotice?.('Read-only — cannot paste');
        return false;
      }
      if (payload.viewLevel !== model.viewLevel) {
        onNotice?.(
          `Paste only on the ${layerLabel(payload.viewLevel)} layer (copied from there)`
        );
        return false;
      }
      if (payload.viewLevel === 'container' && !model.activeSystemId) {
        onNotice?.('Open a system before pasting containers');
        return false;
      }
      if (payload.viewLevel === 'component' && !model.activeContainerId) {
        onNotice?.('Open a container before pasting components');
        return false;
      }
      if (payload.viewLevel === 'code' && !model.activeComponentId) {
        onNotice?.('Open a component before pasting code elements');
        return false;
      }

      const plan = buildPastePlan(payload, pasteGenerationRef.current);
      pasteGenerationRef.current += 1;

      for (const item of plan.items) {
        const audit = stampAuditCreate(user);
        const base = {
          id: item.newId,
          name: item.name,
          description: item.description || '',
          technology: item.technology || '',
          url: item.url || '',
          position: item.position,
          connections: [] as [],
          original: item.original,
          ...audit,
        };

        if (plan.viewLevel === 'system') {
          addSystem({ ...base, type: 'system' });
          if (item.external) updateSystem(item.newId, { external: true } as never);
        } else if (plan.viewLevel === 'container' && model.activeSystemId) {
          addContainer(model.activeSystemId, { ...base, type: 'container' });
          if (item.external) updateContainer(item.newId, { external: true } as never);
        } else if (plan.viewLevel === 'component' && model.activeContainerId) {
          addComponent(model.activeContainerId, { ...base, type: 'component' });
          if (item.external) updateComponent(item.newId, { external: true } as never);
        } else if (plan.viewLevel === 'code' && model.activeComponentId) {
          addCodeElement(model.activeComponentId, {
            ...base,
            type: 'code',
            codeType: item.codeType || 'class',
            code: item.code || '',
          });
        }
      }

      const connect =
        plan.viewLevel === 'system'
          ? connectSystems
          : plan.viewLevel === 'container'
            ? connectContainers
            : plan.viewLevel === 'component'
              ? connectComponents
              : connectCodeElements;

      for (const item of plan.items) {
        for (const conn of item.connections) {
          connect(item.newId, conn);
        }
      }

      onNotice?.(`Pasted ${plan.items.length} element(s)`);
      return true;
    },
    [
      canPaste,
      model.viewLevel,
      model.activeSystemId,
      model.activeContainerId,
      model.activeComponentId,
      addSystem,
      addContainer,
      addComponent,
      addCodeElement,
      connectSystems,
      connectContainers,
      connectComponents,
      connectCodeElements,
      updateSystem,
      updateContainer,
      updateComponent,
      user,
      onNotice,
    ]
  );

  const paste = useCallback(async () => {
    if (memoryClipboard) {
      return applyPaste(memoryClipboard);
    }
    try {
      const text = await navigator.clipboard?.readText();
      if (!text) return false;
      const payload = parseClipboardPayload(text);
      if (!payload) return false;
      memoryClipboard = payload;
      return applyPaste(payload);
    } catch {
      return false;
    }
  }, [applyPaste]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === 'c') {
        if (copy()) {
          event.preventDefault();
        }
      } else if (key === 'v') {
        event.preventDefault();
        void paste();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, copy, paste]);
}
