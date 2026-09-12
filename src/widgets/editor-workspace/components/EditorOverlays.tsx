import DataFlowsPage from '@/pages/DataFlowsPage';
import ServiceCatalogPage from '@/pages/ServiceCatalogPage';
import { closeCatalogOverlay } from '@plugins/service-catalog/uiState';
import { closeDataFlowManager } from '@plugins/data-flows/uiState';
import {
  APP_FOOTER_OFFSET,
  SIDE_PANEL_INSET,
  WORKSPACE_CONTENT_TOP,
  WORKSPACE_EDITOR_Z,
} from '@theme/sidePanelLayout';
import { Box } from '@chakra-ui/react';

type OverlayFrameProps = {
  children: React.ReactNode;
  /** Keep the tree mounted but off-screen so the next open paints immediately. */
  hidden?: boolean;
};

function OverlayFrame({ children, hidden = false }: OverlayFrameProps) {
  return (
    <Box
      position="absolute"
      top={WORKSPACE_CONTENT_TOP}
      left={SIDE_PANEL_INSET}
      right={SIDE_PANEL_INSET}
      bottom={`calc(${APP_FOOTER_OFFSET} + ${SIDE_PANEL_INSET})`}
      zIndex={WORKSPACE_EDITOR_Z}
      display={hidden ? 'none' : undefined}
      aria-hidden={hidden || undefined}
      pointerEvents={hidden ? 'none' : undefined}
    >
      <Box h="100%" overflow="hidden">
        {children}
      </Box>
    </Box>
  );
}

type Props = {
  /** Kept for call-site compatibility; Community has no projects manager. */
  projectsOpen: boolean;
  onCloseProjects: () => void;
  onGoLocal?: () => void;
  projectMode: boolean;
  projectId: string | undefined;
  canWrite: boolean;
  canAdminister: boolean;
  viewOnly: boolean;
  versionsAvailable: boolean;
  catalogOverlay: { selectedId?: string | null } | null;
  changeSetsOverlay: { selectedId?: string | null } | null;
  branchesOverlay: { selectedId?: string | null } | null;
  compareOverlay: unknown;
  domainsOverlay: { selectedId?: string | null } | null;
  dataFlowManager: { flowId?: string | null; stepId?: string | null } | null;
};

export default function EditorOverlays({
  projectMode,
  viewOnly,
  catalogOverlay,
  dataFlowManager,
}: Props) {
  return (
    <>
      {catalogOverlay ? (
        <OverlayFrame>
          <ServiceCatalogPage
            projectMode={projectMode}
            embedded
            initialSelectedId={catalogOverlay.selectedId ?? null}
            onRequestClose={() => closeCatalogOverlay()}
          />
        </OverlayFrame>
      ) : null}

      {dataFlowManager ? (
        <OverlayFrame>
          <DataFlowsPage
            projectMode={projectMode}
            embedded
            initialFlowId={dataFlowManager.flowId ?? null}
            initialStepId={dataFlowManager.stepId ?? null}
            canWriteOverride={projectMode ? !viewOnly : true}
            onRequestClose={() => closeDataFlowManager()}
          />
        </OverlayFrame>
      ) : null}
    </>
  );
}
