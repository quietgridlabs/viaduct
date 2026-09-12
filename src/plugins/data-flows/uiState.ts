import type { ViewLevel } from '@archivisio/c4-modelizer-sdk';
import { trackProductEvent } from '@/metrics';

export type DataFlowReturnView = {
  viewLevel: ViewLevel;
  activeSystemId?: string;
  activeContainerId?: string;
  activeComponentId?: string;
};

/** One frame on the continuation stack — where Previous returns after a link hop. */
export type DataFlowPlaybackFrame = {
  flowId: string;
  stepIndex: number;
  homeProjectId?: string;
  flowSnapshot?: import('@/types/c4Extensions').StoredDataFlow;
  showAll?: boolean;
  stepCount?: number;
  /** Chosen OR branch within the stage at `stepIndex`, if any. */
  branchStepId?: string | null;
  /**
   * Where Next should land in this flow after the linked child finishes.
   * Absent/null means the link was the last stage — finishing the child ends
   * the journey (Previous still returns to `stepIndex`).
   */
  resumeAfterStepIndex?: number | null;
};

export type DataFlowPlaybackSession = {
  flowId: string;
  stepIndex: number;
  returnView?: DataFlowReturnView | null;
  /**
   * Show every element the flow touches on this level at once, instead of the
   * current hop. The step index is kept, so turning it off resumes where the
   * reader was.
   */
  showAll?: boolean;
  /** How long the journey is — carried for metrics, ignored by the player. */
  stepCount?: number;
  /** Project where the flow is stored (for cross-domain hops). */
  homeProjectId?: string;
  /** Snapshot so playback can continue on a remote project that lacks the flow. */
  flowSnapshot?: import('@/types/c4Extensions').StoredDataFlow;
  /**
   * Flows we jumped from via a link step, oldest first. Previous at the start
   * of the current flow pops the last frame.
   */
  stack?: DataFlowPlaybackFrame[];
  /**
   * On an OR (`alternative`) stage: which branch is being played. Absent/null
   * means the fork is open and the reader still has to pick. Parallel stages
   * ignore this — every branch plays together.
   */
  branchStepId?: string | null;
};

export type DataFlowSidebarState = {
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  ownerName: string;
} | null;

export type DataFlowManagerSession = {
  flowId?: string;
  stepId?: string;
} | null;

type Listener = () => void;

type DataFlowUiStore = {
  playback: DataFlowPlaybackSession | null;
  manager: DataFlowManagerSession;
  sidebar: DataFlowSidebarState;
  /**
   * Set just before navigating into a linked flow; consumed by the next
   * `openDataFlowPlayback` so a fresh Play does not inherit an old stack.
   */
  pendingPlaybackStack: DataFlowPlaybackFrame[] | null;
  listeners: Set<Listener>;
};

/**
 * Must live on globalThis: plugin is dynamically loaded while EditorPage
 * imports this module statically.
 */
const STORE_KEY = '__c4DataFlowUi__';

function getStore(): DataFlowUiStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: DataFlowUiStore };
  const store = (g[STORE_KEY] ??= {
    playback: null,
    manager: null,
    sidebar: null,
    pendingPlaybackStack: null,
    listeners: new Set(),
  });
  store.manager ??= null;
  store.sidebar ??= null;
  store.pendingPlaybackStack ??= null;
  return store;
}

function emit() {
  getStore().listeners.forEach((l) => l());
}

export function subscribeDataFlowPlayback(listener: Listener): () => void {
  getStore().listeners.add(listener);
  return () => getStore().listeners.delete(listener);
}

export function getDataFlowPlayback(): DataFlowPlaybackSession | null {
  return getStore().playback;
}

export function isDataFlowPlaybackOpen(): boolean {
  return getStore().playback != null;
}

export function openDataFlowPlayback(next: DataFlowPlaybackSession): void {
  const store = getStore();
  const previous = store.playback;
  const sameFlow = previous?.flowId === next.flowId;
  const prevReturnView = previous?.returnView ?? null;
  /* Only a fresh start counts: stepping through a flow re-enters this with the
     same id, and that is one playback, not twenty. */
  if (!sameFlow) {
    trackProductEvent('flow.played', { steps: next.stepCount ?? 0 });
  }
  const pendingStack = store.pendingPlaybackStack;
  store.pendingPlaybackStack = null;
  const stack =
    next.stack ??
    pendingStack ??
    (sameFlow ? previous?.stack : undefined) ??
    [];
  store.playback = {
    flowId: next.flowId,
    stepIndex: Math.max(0, next.stepIndex || 0),
    returnView: next.returnView ?? prevReturnView,
    showAll: next.showAll ?? false,
    stepCount: next.stepCount,
    homeProjectId: next.homeProjectId ?? (sameFlow ? previous?.homeProjectId : undefined),
    /* A different flow gets a clean slate — falling back to the outgoing
       flow's snapshot here is how a continuation into another project's flow
       kept showing the flow it just left, its name and steps included, while
       the URL and canvas had already moved on. Re-entering the *same* flow
       (a step-only URL, say) still keeps its snapshot if this call omits one. */
    flowSnapshot: next.flowSnapshot ?? (sameFlow ? previous?.flowSnapshot : undefined),
    stack,
    branchStepId:
      next.branchStepId !== undefined
        ? next.branchStepId
        : sameFlow
          ? previous?.branchStepId
          : null,
  };
  store.sidebar = null;
  emit();
}

export function patchDataFlowPlayback(patch: Partial<DataFlowPlaybackSession>): void {
  const current = getStore().playback;
  if (!current) return;
  getStore().playback = {
    flowId: patch.flowId ?? current.flowId,
    stepIndex: Math.max(0, patch.stepIndex ?? current.stepIndex),
    returnView: patch.returnView ?? current.returnView ?? null,
    showAll: patch.showAll ?? current.showAll ?? false,
    stepCount: patch.stepCount ?? current.stepCount,
    homeProjectId: patch.homeProjectId ?? current.homeProjectId,
    flowSnapshot: patch.flowSnapshot ?? current.flowSnapshot,
    stack: patch.stack ?? current.stack,
    branchStepId:
      patch.branchStepId !== undefined ? patch.branchStepId : current.branchStepId,
  };
  emit();
}

/**
 * Remember the current frame, then let the caller navigate to the linked flow.
 * The next `openDataFlowPlayback` picks up the pending stack.
 *
 * `resumeAfterStepIndex` is the hop in this flow that plays after the child
 * finishes — so a mid-flow link does not strand the reader at the end of the
 * linked journey.
 */
export function pushDataFlowPlaybackForContinuation(opts?: {
  resumeAfterStepIndex?: number | null;
}): DataFlowPlaybackFrame | null {
  const current = getStore().playback;
  if (!current) return null;
  const frame: DataFlowPlaybackFrame = {
    flowId: current.flowId,
    stepIndex: current.stepIndex,
    homeProjectId: current.homeProjectId,
    flowSnapshot: current.flowSnapshot,
    showAll: current.showAll,
    stepCount: current.stepCount,
    branchStepId: current.branchStepId,
    resumeAfterStepIndex:
      opts && 'resumeAfterStepIndex' in opts ? opts.resumeAfterStepIndex ?? null : null,
  };
  getStore().pendingPlaybackStack = [...(current.stack || []), frame];
  return frame;
}

/** Hand a stack to the next `openDataFlowPlayback` (e.g. after popping a frame). */
export function setPendingPlaybackStack(stack: DataFlowPlaybackFrame[]): void {
  getStore().pendingPlaybackStack = stack;
}

/** Pop the last continuation frame, or null if the stack is empty. */
export function popDataFlowPlaybackStack(): {
  frame: DataFlowPlaybackFrame;
  rest: DataFlowPlaybackFrame[];
} | null {
  const current = getStore().playback;
  const stack = current?.stack || [];
  if (!stack.length) return null;
  const frame = stack[stack.length - 1]!;
  const rest = stack.slice(0, -1);
  return { frame, rest };
}

export function closeDataFlowPlayback(): void {
  const store = getStore();
  if (!store.playback && !store.pendingPlaybackStack) return;
  store.playback = null;
  store.pendingPlaybackStack = null;
  emit();
}

export function getDataFlowManager(): DataFlowManagerSession {
  return getStore().manager;
}

export function openDataFlowManager(next?: NonNullable<DataFlowManagerSession>): void {
  getStore().manager = {
    flowId: next?.flowId,
    stepId: next?.stepId,
  };
  getStore().sidebar = null;
  emit();
}

export function patchDataFlowManager(patch: Partial<NonNullable<DataFlowManagerSession>>): void {
  const current = getStore().manager ?? {};
  getStore().manager = {
    flowId: patch.flowId ?? current.flowId,
    stepId: patch.stepId ?? current.stepId,
  };
  emit();
}

export function closeDataFlowManager(): void {
  if (!getStore().manager) return;
  getStore().manager = null;
  emit();
}

export function getDataFlowSidebar(): DataFlowSidebarState {
  return getStore().sidebar;
}

export function openDataFlowSidebar(next: NonNullable<DataFlowSidebarState>): void {
  getStore().sidebar = next;
  emit();
}

export function closeDataFlowSidebar(): void {
  if (!getStore().sidebar) return;
  getStore().sidebar = null;
  emit();
}

export function toggleDataFlowSidebar(next: NonNullable<DataFlowSidebarState>): void {
  const current = getStore().sidebar;
  if (
    current &&
    current.ownerType === next.ownerType &&
    current.ownerId === next.ownerId
  ) {
    getStore().sidebar = null;
  } else {
    getStore().sidebar = next;
  }
  emit();
}
