import type { NavTrailFrame } from '@/navigation/navTrail';
import { Box as BoxIcon, FileText, GitBranch, Layers, Network, Package, Route } from 'lucide-react';
import type { ReactNode } from 'react';
import { DEFAULT_PROJECT_NAME, NAV_ICON_SIZE } from './constants';
import type { C4Segment } from './types';

/** What kind of place a trail frame is. */
export function frameIcon(frame: NavTrailFrame): ReactNode {
  const size = NAV_ICON_SIZE;
  if (frame.kind === 'flows') return <Route size={size} />;
  if (frame.kind === 'documentation') return <FileText size={size} />;
  if (frame.kind === 'sequence') return <GitBranch size={size} />;
  if (frame.kind === 'element') return <BoxIcon size={size} />;
  return <Layers size={size} />;
}

/** `/editor`, not `/` — `/` is the marketing page. */
export function editorPathFor(projectMode: boolean, projectId?: string): string {
  return projectMode && projectId ? `/projects/${projectId}` : '/editor';
}

/** An emptied field still leaves the project with a name. */
export function normalizeProjectName(draft: string): string {
  return draft.trim() || DEFAULT_PROJECT_NAME;
}

type SegmentSources = {
  viewLevel: string;
  overlayOpen: boolean;
  schemaMode: boolean;
  brokerMode: boolean;
  activeSystemName?: string;
  activeContainerName?: string;
  activeComponentName?: string;
  t: (key: string) => string;
  onSystems: () => void;
  onContainers: () => void;
  onComponents: () => void;
  onCode: () => void;
};

/**
 * The descent as far as it has been made. Only the deepest of these is ever
 * drawn — see the crumb comment in the pill — but the list is what says which
 * one that is.
 */
export function buildC4Segments(o: SegmentSources): C4Segment[] {
  const segments: C4Segment[] = [];
  /* With an overlay on top, no level is where you are — the overlay is, and
     every level behind it is somewhere to go back to. */
  const levelActive = (level: string) => !o.overlayOpen && o.viewLevel === level;
  const below = (...levels: string[]) => levels.includes(o.viewLevel);

  segments.push({
    key: 'systems',
    active: levelActive('system'),
    label: o.t('systems'),
    icon: <Network size={NAV_ICON_SIZE} />,
    onClick: o.onSystems,
  });

  if (below('container', 'component', 'code') && o.activeSystemName) {
    segments.push({
      key: 'containers',
      active: levelActive('container'),
      label: `${o.activeSystemName} · ${o.t('containers')}`,
      icon: <Package size={NAV_ICON_SIZE} />,
      onClick: o.onContainers,
    });
  }

  if (below('component', 'code') && o.activeContainerName) {
    segments.push({
      key: 'components',
      active: levelActive('component'),
      label: `${o.activeContainerName} · ${
        o.schemaMode ? o.t('schema') : o.brokerMode ? o.t('topics') : o.t('components')
      }`,
      icon: <BoxIcon size={NAV_ICON_SIZE} />,
      onClick: o.onComponents,
    });
  }

  if (below('code') && o.activeComponentName) {
    segments.push({
      key: 'code',
      active: !o.overlayOpen,
      label: `${o.activeComponentName} · ${o.t('code')}`,
      icon: <BoxIcon size={NAV_ICON_SIZE} />,
      onClick: o.onCode,
    });
  }

  return segments;
}
