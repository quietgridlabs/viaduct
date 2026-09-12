import {
  getSequenceCollabApi,
  makeSequenceDiagramKey,
  type SequenceEditLock,
} from './collabBridge';
import { trackProductEvent } from '@/metrics';

export type SequenceOwnerRef = {
  ownerType: 'container' | 'component';
  ownerId: string;
};

export type SequenceEditorSession = {
  /** Stable React key for the open editor instance (survives first save id assign). */
  editorKey: string;
  /**
   * Manager open with no diagram selected — list + empty state, no draft yet.
   * Cleared when the user picks a diagram or clicks Add.
   */
  idle?: boolean;
  /** Unbound draft until user picks a container/component to attach. */
  ownerType?: 'container' | 'component';
  ownerId?: string;
  diagramId?: string;
  diagramName: string;
  plantUmlSource: string;
  readOnly?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { name: string; username: string };
  updatedBy?: { name: string; username: string };
};

function newEditorKey(): string {
  return `seqed_${Math.random().toString(36).slice(2, 10)}`;
}

export type SequenceDiagramsSidebarState = {
  ownerType: 'container' | 'component';
  ownerId: string;
  ownerName: string;
} | null;

export type OpenSequenceEditorResult =
  | { ok: true }
  | { ok: false; lock: SequenceEditLock };

type Listener = () => void;

let session: SequenceEditorSession | null = null;
let sidebar: SequenceDiagramsSidebarState = null;
/** Project write access — view role opens sequences read-only (no code / no edit lock). */
let editorCanEdit = true;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function setSequenceEditorCanEdit(canEdit: boolean): void {
  if (editorCanEdit === canEdit) return;
  editorCanEdit = canEdit;
  emit();
}

export function getSequenceEditorCanEdit(): boolean {
  return editorCanEdit;
}

function diagramKeyFromSession(s: SequenceEditorSession): string | null {
  if (!s.ownerType || !s.ownerId || !s.diagramId) return null;
  return makeSequenceDiagramKey(s.ownerType, s.ownerId, s.diagramId);
}

function applyLocalSequenceLock(s: SequenceEditorSession | null) {
  const api = getSequenceCollabApi();
  if (!api.enabled) return;
  // Viewers must not claim the exclusive edit lock.
  if (!s || s.readOnly) {
    api.setLock(null);
    return;
  }
  const key = diagramKeyFromSession(s);
  api.setLock(key);
}

export function subscribeSequenceEditor(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSequenceEditorSession(): SequenceEditorSession | null {
  return session;
}

export function isSequenceEditorOpen(): boolean {
  return session != null;
}

export function getSequenceDiagramLock(
  ownerType: string,
  ownerId: string,
  diagramId: string
): SequenceEditLock | null {
  const api = getSequenceCollabApi();
  if (!api.enabled) return null;
  return api.getLock(makeSequenceDiagramKey(ownerType, ownerId, diagramId));
}

/** Opens editor; blocks if another peer holds the diagram lock (edit opens only). */
export function tryOpenSequenceEditor(
  next: Omit<SequenceEditorSession, 'editorKey'> & { editorKey?: string }
): OpenSequenceEditorResult {
  const withKey: SequenceEditorSession = {
    ...next,
    readOnly: next.readOnly ?? !editorCanEdit,
    editorKey: next.editorKey ?? newEditorKey(),
  };
  const key = diagramKeyFromSession(withKey);
  if (key && !withKey.readOnly) {
    const lock = getSequenceCollabApi().getLock(key);
    if (lock) return { ok: false, lock };
  }
  session = withKey;
  sidebar = null;
  applyLocalSequenceLock(session);
  /* Counted here rather than at the callers: this is the only path that
     actually opens the editor, and the only one that can be refused above. */
  trackProductEvent('sequence.opened');
  emit();
  return { ok: true };
}

export function openSequenceEditor(
  next: Omit<SequenceEditorSession, 'editorKey'> & { editorKey?: string }
): void {
  tryOpenSequenceEditor(next);
}

/** Opens the sequence manager without creating a draft diagram. */
export function openSequenceManager(opts?: { readOnly?: boolean }): void {
  openSequenceEditor({
    idle: true,
    diagramName: '',
    plantUmlSource: '',
    readOnly: opts?.readOnly,
  });
}

export function patchSequenceEditorSession(
  patch: Partial<Omit<SequenceEditorSession, 'editorKey'>> & {
    /** Remount the editor (owner/diagram switch). Default keeps key (e.g. first save). */
    renewEditorKey?: boolean;
  }
): OpenSequenceEditorResult {
  if (!session) return { ok: true };
  const { renewEditorKey, ...rest } = patch;
  const next: SequenceEditorSession = {
    ...session,
    ...rest,
    editorKey: renewEditorKey ? newEditorKey() : session.editorKey,
  };
  const key = diagramKeyFromSession(next);
  if (key && !next.readOnly) {
    const lock = getSequenceCollabApi().getLock(key);
    if (lock) return { ok: false, lock };
  }
  session = next;
  applyLocalSequenceLock(session);
  emit();
  return { ok: true };
}

export function closeSequenceEditor(): void {
  session = null;
  applyLocalSequenceLock(null);
  emit();
}

/** Keep session source in sync without notifying subscribers (same object ref). */
export function updateSequenceEditorSource(source: string): void {
  if (!session || session.plantUmlSource === source) return;
  // Mutate in place — replacing the object without emit breaks useSyncExternalStore.
  session.plantUmlSource = source;
}

export function getSequenceDiagramsSidebar(): SequenceDiagramsSidebarState {
  return sidebar;
}

export function openSequenceDiagramsSidebar(next: NonNullable<SequenceDiagramsSidebarState>): void {
  sidebar = next;
  emit();
}

export function closeSequenceDiagramsSidebar(): void {
  sidebar = null;
  emit();
}

export function toggleSequenceDiagramsSidebar(
  next: NonNullable<SequenceDiagramsSidebarState>
): void {
  if (
    sidebar &&
    sidebar.ownerType === next.ownerType &&
    sidebar.ownerId === next.ownerId
  ) {
    sidebar = null;
  } else {
    sidebar = next;
  }
  emit();
}
