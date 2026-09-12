import type React from 'react';

/** Label container sits in the edge portal layer, centred on the label point.
 *  Keep z-index at 0 — a positive value escapes the edgelabel renderer and
 *  paints over cards, even though the renderer itself sits under `.react-flow__nodes`. */
export const EDGE_LABEL_CONTAINER_STYLE: React.CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'all',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: 40,
  minHeight: 24,
  zIndex: 0,
};

/* A label reading "calls 1" at a fifth of its size is a grey dash, and there
   is one per edge: 1 200 extra elements on a 400-block level, none of them
   legible. Safe to drop where the card's own handles were not — a label lives
   in its own portal layer and the edge's geometry does not depend on it. */
export const LOD_ZOOM = 0.4;

/* Arrowheads in flow units, not stroke widths.
   React Flow's own marker is sized in `markerUnits="strokeWidth"`, so the head
   grew with the line: a hairline connection got a speck and a picked one a
   wedge. A head says "this way round" — the same job at every weight — so it
   keeps one size and only the picked edge gets a slightly larger one. */
export const ARROW = { length: 12, half: 4.6 };
export const ARROW_SELECTED = { length: 14, half: 5.4 };

/* The socket marker: a filled disc big enough to cover the node's own handle
   (9px plus a 2px border), with a dark core. Hollow rings left the grey handle
   showing through and read as a smudge rather than a marked connection. */
export const SOCKET_R = 7.5;
export const SOCKET_CORE_R = 3;
export const SOCKET_CORE_INK = '#0b0f16';

/** How far an anchor may drift from a path end before the head ignores it. */
export const ANCHOR_TRUST_PX = 20;
