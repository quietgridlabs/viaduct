import { createContext } from 'react';

/** False while a covering glass overlay is open — pause infinite SVG motion. */
export const CanvasMotionContext = createContext(true);
