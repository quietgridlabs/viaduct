import type {
  CodeBlock,
  ComponentBlock,
  ConnectionData,
  ContainerBlock,
  FlatC4Model,
  SystemBlock,
  ViewLevel,
} from '@archivisio/c4-modelizer-sdk';
import type { ConnectionExtras, ExternalFlag } from '@/types/c4Extensions';

export const DIAGRAM_CLIPBOARD_MIME = 'application/x-c4-modelizer-clipboard';

export type ClipboardElement = {
  id: string;
  name: string;
  description?: string;
  technology?: string;
  url?: string;
  position: { x: number; y: number };
  type: ViewLevel;
  external?: boolean;
  original?: { id: string; type: ViewLevel };
  codeType?: CodeBlock['codeType'];
  code?: string;
  connections: (ConnectionData & ConnectionExtras)[];
};

export type DiagramClipboardPayload = {
  version: 1;
  viewLevel: ViewLevel;
  elements: ClipboardElement[];
};

type BlockLike = (SystemBlock | ContainerBlock | ComponentBlock | CodeBlock) &
  ExternalFlag & {
    connections: ConnectionData[];
    original?: { id: string; type: ViewLevel };
    codeType?: CodeBlock['codeType'];
    code?: string;
  };

const PASTE_OFFSET = 48;

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `paste-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  // Monaco Editor (textarea or EditContext div) / React Flow opt-out
  if (
    target.closest('.monaco-editor') ||
    target.closest('.native-edit-context') ||
    target.closest('.nokey')
  ) {
    return true;
  }
  return false;
}

export function buildClipboardPayload(
  model: FlatC4Model,
  selectedIds: string[]
): DiagramClipboardPayload | null {
  if (!selectedIds.length) return null;
  const level = model.viewLevel;
  const selected = new Set(selectedIds);
  const blocks = getBlocksForLevel(model, level).filter((b) => selected.has(b.id));
  if (!blocks.length) return null;

  const elements: ClipboardElement[] = blocks.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    technology: b.technology,
    url: b.url,
    position: { ...b.position },
    type: level,
    external: Boolean((b as ExternalFlag).external),
    original: b.original
      ? { id: b.original.id, type: b.original.type as ViewLevel }
      : undefined,
    codeType: b.type === 'code' ? b.codeType : undefined,
    code: b.type === 'code' ? b.code : undefined,
    connections: (b.connections || [])
      .filter((c) => selected.has(c.targetId))
      .map((c) => ({ ...c })),
  }));

  return { version: 1, viewLevel: level, elements };
}

function getBlocksForLevel(model: FlatC4Model, level: ViewLevel): BlockLike[] {
  switch (level) {
    case 'system':
      return model.systems as BlockLike[];
    case 'container':
      return model.containers as BlockLike[];
    case 'component':
      return model.components as BlockLike[];
    case 'code':
      return model.codeElements as BlockLike[];
    default:
      return [];
  }
}

export function parseClipboardPayload(raw: string): DiagramClipboardPayload | null {
  try {
    const data = JSON.parse(raw) as DiagramClipboardPayload;
    if (data?.version !== 1 || !data.viewLevel || !Array.isArray(data.elements)) {
      return null;
    }
    if (!data.elements.length) return null;
    return data;
  } catch {
    return null;
  }
}

export type PastePlanItem = {
  oldId: string;
  newId: string;
  name: string;
  description?: string;
  technology?: string;
  url?: string;
  position: { x: number; y: number };
  external?: boolean;
  original?: { id: string; type: ViewLevel };
  codeType?: CodeBlock['codeType'];
  code?: string;
  connections: (ConnectionData & ConnectionExtras)[];
};

export type PastePlan = {
  viewLevel: ViewLevel;
  items: PastePlanItem[];
};

/** Build paste plan with new IDs, offset positions, remapped intra-selection connections. */
export function buildPastePlan(
  payload: DiagramClipboardPayload,
  pasteGeneration = 0
): PastePlan {
  const idMap = new Map<string, string>();
  for (const el of payload.elements) {
    idMap.set(el.id, newId());
  }

  const offset = PASTE_OFFSET * (pasteGeneration + 1);
  const items: PastePlanItem[] = payload.elements.map((el) => {
    const newIdValue = idMap.get(el.id)!;
    const connections: (ConnectionData & ConnectionExtras)[] = [];
    for (const c of el.connections || []) {
      const newTarget = idMap.get(c.targetId);
      if (!newTarget) continue;
      const related = (c as ConnectionExtras).relatedComponentIds;
      connections.push({
        ...c,
        targetId: newTarget,
        ...(related
          ? {
              relatedComponentIds: related
                .map((id) => idMap.get(id))
                .filter((id): id is string => Boolean(id)),
            }
          : {}),
      });
    }

    return {
      oldId: el.id,
      newId: newIdValue,
      name: el.name,
      description: el.description,
      technology: el.technology,
      url: el.url,
      position: {
        x: el.position.x + offset,
        y: el.position.y + offset,
      },
      external: el.external,
      original: el.original,
      codeType: el.codeType,
      code: el.code,
      connections,
    };
  });

  return { viewLevel: payload.viewLevel, items };
}

export function layerLabel(level: ViewLevel): string {
  switch (level) {
    case 'system':
      return 'system';
    case 'container':
      return 'container';
    case 'component':
      return 'component';
    case 'code':
      return 'code';
    default:
      return level;
  }
}
