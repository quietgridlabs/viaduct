import { registerCanvasFitView, unregisterCanvasFitView } from '@/navigation/fitViewBridge';
import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import type { NavBarProps } from './types';

/** Registers canvas fitView — nav UI is in WorkspaceNavPill. */
export default function NavBar(_props: NavBarProps) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    registerCanvasFitView(fitView);
    return () => unregisterCanvasFitView(fitView);
  }, [fitView]);

  return null;
}
