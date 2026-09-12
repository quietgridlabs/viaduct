import type { EdgePathType } from '@/types/c4Extensions';

export type ExploreContainerOption = {
  id: string;
  name: string;
  /** False when this container has no explicit related components on the edge. */
  enabled: boolean;
};

export type EdgeActionMenuProps = {
  anchorPosition: { top: number; left: number } | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** When false, Edit is omitted — view-only / sealed boards. */
  canEdit?: boolean;
  onExplore: (focusContainerId: string) => void;
  onDelete: () => void;
  exploreContainers?: ExploreContainerOption[];
  showExplore?: boolean;
  canDelete?: boolean;
  pathType?: EdgePathType;
  onPathTypeChange?: (pathType: EdgePathType) => void;
};
