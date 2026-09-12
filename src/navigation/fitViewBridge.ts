import type { FitViewOptions } from '@xyflow/react';

type FitViewFn = (options?: FitViewOptions) => void;

let fitViewFn: FitViewFn | null = null;

export function registerCanvasFitView(fn: FitViewFn): void {
  fitViewFn = fn;
}

export function unregisterCanvasFitView(fn: FitViewFn): void {
  if (fitViewFn === fn) fitViewFn = null;
}

export function canvasFitView(options?: FitViewOptions): void {
  fitViewFn?.(options ?? { padding: 0.2, includeHiddenNodes: false });
}
