import type { InlineDocumentation, PersonRef } from '@/types/c4Extensions';
import { trackProductEvent } from '@/metrics';

type OwnerType = 'system' | 'container' | 'component' | 'code';

export type DocumentationEditorSession = {
  editorKey: string;
  /**
   * Manager open with nothing picked — the list plus an empty state, and no
   * document brought into being just because someone opened the menu.
   */
  idle?: boolean;
  /** Cloud project id, or `local` for guest editor. */
  projectId: string;
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  docId?: string;
  title: string;
  markdown: string;
  canEdit: boolean;
  /** Hidden while peeking at the diagram — keeps Monaco/Yjs mounted. */
  hidden?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: PersonRef;
  updatedBy?: PersonRef;
};

export type DocumentationSidebarState = {
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  /**
   * Docs already projected onto a clone card. Used when the owner isn't in the
   * local model (remote clone) or the store lookup would otherwise come up empty
   * while the badge correctly showed a count.
   */
  documentations?: InlineDocumentation[];
};

export type DocumentationContext = {
  mode: 'cloud' | 'local';
  projectId: string | null;
  canEdit: boolean;
};

type Listener = () => void;

type DocsUiStore = {
  session: DocumentationEditorSession | null;
  context: DocumentationContext | null;
  sidebarState: DocumentationSidebarState | null;
  listeners: Set<Listener>;
};

/**
 * Must live on globalThis: docs-editor is both statically imported (EditorPage)
 * and dynamically loaded as a plugin. Separate module instances would otherwise
 * fork context/session and make toolbar/badge silently no-op.
 */
const STORE_KEY = '__c4DocsEditorUi__';

function getStore(): DocsUiStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: DocsUiStore };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      session: null,
      context: null,
      sidebarState: null,
      listeners: new Set(),
    };
  }
  return g[STORE_KEY];
}

function emit() {
  getStore().listeners.forEach((l) => l());
}

function newEditorKey(): string {
  return `doced_${Math.random().toString(36).slice(2, 10)}`;
}

export function setDocumentationContext(next: DocumentationContext | null) {
  getStore().context = next;
  emit();
}

export function getDocumentationContext() {
  return getStore().context;
}

export function isLocalDocumentationContext(
  ctx: DocumentationContext | null | undefined = getStore().context
) {
  return ctx?.mode === 'local';
}

export function subscribeDocumentationEditor(listener: Listener) {
  const { listeners } = getStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDocumentationEditorSession() {
  return getStore().session;
}

export function isDocumentationEditorOpen() {
  return getStore().session != null;
}

/** Open and actually on screen — not a peek while the diagram is in front. */
export function isDocumentationEditorVisible() {
  const session = getStore().session;
  return session != null && !session.hidden;
}

export function openDocumentationEditor(next: {
  projectId?: string;
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  docId?: string;
  title?: string;
  markdown?: string;
  canEdit?: boolean;
  idle?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: PersonRef;
  updatedBy?: PersonRef;
}) {
  const store = getStore();
  const ctx = store.context;
  const projectId =
    next.projectId ||
    (ctx?.mode === 'cloud' && ctx.projectId ? ctx.projectId : 'local');
  /* Every way into the documentation editor lands here — the instruments
     menu, a badge on a card, a link from a flow. Owner level only. */
  trackProductEvent('docs.opened', { owner: next.ownerType });
  store.session = {
    editorKey: newEditorKey(),
    idle: next.idle,
    projectId,
    ownerType: next.ownerType,
    ownerId: next.ownerId,
    ownerName: next.ownerName,
    docId: next.docId,
    /* A page opened on an element is named after it; one started from the
       manager has no owner yet, so it stays untitled rather than becoming
       " documentation". */
    title: next.idle
      ? ''
      : next.title || (next.ownerName ? `${next.ownerName} documentation` : ''),
    markdown: next.markdown || '',
    canEdit: next.canEdit ?? ctx?.canEdit ?? true,
    hidden: false,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    createdBy: next.createdBy,
    updatedBy: next.updatedBy,
  };
  emit();
}

/** Manager view: the list with nothing opened, and nothing created either. */
export function openDocumentationManager(opts?: { canEdit?: boolean; projectId?: string }): void {
  openDocumentationEditor({
    idle: true,
    projectId: opts?.projectId,
    ownerType: 'system',
    ownerId: '',
    ownerName: '',
    canEdit: opts?.canEdit,
  });
}

export function setDocumentationEditorHidden(hidden: boolean) {
  const store = getStore();
  if (!store.session || store.session.hidden === hidden) return;
  store.session = { ...store.session, hidden };
  emit();
}

export function patchDocumentationEditorSession(
  patch: Partial<Omit<DocumentationEditorSession, 'editorKey'>> & {
    renewEditorKey?: boolean;
  }
) {
  const store = getStore();
  if (!store.session) return;
  const { renewEditorKey, ...rest } = patch;
  store.session = {
    ...store.session,
    ...rest,
    editorKey: renewEditorKey ? newEditorKey() : store.session.editorKey,
  };
  emit();
}

export function closeDocumentationEditor() {
  getStore().session = null;
  emit();
}

export function getDocumentationSidebar() {
  return getStore().sidebarState;
}

export function openDocumentationSidebar(next: DocumentationSidebarState) {
  getStore().sidebarState = next;
  emit();
}

export function closeDocumentationSidebar() {
  getStore().sidebarState = null;
  emit();
}

export function toggleDocumentationSidebar(next: DocumentationSidebarState) {
  const store = getStore();
  if (
    store.sidebarState?.ownerId === next.ownerId &&
    store.sidebarState?.ownerType === next.ownerType
  ) {
    store.sidebarState = null;
  } else {
    store.sidebarState = next;
  }
  emit();
}

export function subscribeDocumentationSidebar(listener: Listener) {
  const { listeners } = getStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
