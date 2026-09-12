import { canvasSafeTechColor } from '@data/technologies';
import type { Technology } from '@data/technologies';
import { neutralAccentColor } from '@theme/canvasSurfaces';
import type { PaletteMode } from '@theme/theme';
import type { EdgePathType } from '@/types/c4Extensions';
import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';
import type React from 'react';
import { LOD_ZOOM } from './constants';

export type PathEnd = { x: number; y: number; angle: number };

let pathProbe: SVGPathElement | null = null;

export function createEdgeStyle(
  style: React.CSSProperties | undefined,
  _isBidirectional: boolean,
  technology: Technology | undefined,
  mode: PaletteMode,
  plainEdges: boolean
): React.CSSProperties {
  const { filter: _filter, animation: _animation, ...rest } = style || {};
  return {
    ...rest,
    animation: 'none' as const,
    stroke: plainEdges
      ? neutralAccentColor(mode)
      : canvasSafeTechColor(technology?.color, (rest.stroke as string) || '#1f75cb', mode),
  };
}

/* Where a path ends and which way it is heading there — the two numbers an
   arrowhead needs. Taken from the path itself rather than from the handle's
   side, so it stays right for straight and step edges too. */
export function measureSvgPath(
  d: string
): { length: number; start: PathEnd; end: PathEnd } | null {
  if (typeof document === 'undefined' || !d) return null;
  if (!pathProbe) {
    pathProbe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  }
  pathProbe.setAttribute('d', d);
  const length = pathProbe.getTotalLength();
  if (!length) return null;
  const step = Math.min(3, length / 4);
  const at = (distance: number, from: number): PathEnd => {
    const tip = pathProbe!.getPointAtLength(distance);
    const behind = pathProbe!.getPointAtLength(from);
    return {
      x: tip.x,
      y: tip.y,
      angle: (Math.atan2(tip.y - behind.y, tip.x - behind.x) * 180) / Math.PI,
    };
  };
  return { length, start: at(0, step), end: at(length, length - step) };
}

export function pointAlongSvgPath(
  d: string,
  t: number
): { x: number; y: number } | null {
  if (typeof document === 'undefined' || !d) return null;
  if (!pathProbe) {
    pathProbe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  }
  pathProbe.setAttribute('d', d);
  const len = pathProbe.getTotalLength();
  if (!len) return null;
  const p = pathProbe.getPointAtLength(len * Math.max(0, Math.min(1, t)));
  return { x: p.x, y: p.y };
}

export function buildEdgePath(
  pathType: EdgePathType,
  params: {
    sourceX: number;
    sourceY: number;
    sourcePosition: EdgeProps['sourcePosition'];
    targetX: number;
    targetY: number;
    targetPosition: EdgeProps['targetPosition'];
  }
): { path: string; labelX: number; labelY: number } {
  if (pathType === 'straight') {
    const [path, labelX, labelY] = getStraightPath(params);
    return { path, labelX, labelY };
  }
  if (pathType === 'step') {
    const [path, labelX, labelY] = getSmoothStepPath({
      ...params,
      borderRadius: 0,
    });
    return { path, labelX, labelY };
  }
  const [path, labelX, labelY] = getBezierPath(params);
  return { path, labelX, labelY };
}

export const selectZoomedOut = (state: { transform: [number, number, number] }) =>
  state.transform[2] < LOD_ZOOM;
