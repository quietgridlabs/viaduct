import { canvasFitView } from '@/navigation/fitViewBridge';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import {
  canForwardNavTrail,
  forwardNavTrail,
  getNavTrailSnapshot,
  popNavTrail,
  subscribeNavTrail,
  type NavTrailFrame,
} from '@/navigation/navTrail';
import { useRouterHistoryStack } from '@/navigation/useRouterHistoryStack';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import InstrumentsMenu from '@components/InstrumentsMenu';
import { emitProjectRenamed, subscribeProjectRename } from '@/state/projectRename';
import PortalTarget from '@slots/PortalTarget';
import { useFlatActiveElements, useFlatC4Store, useFlatNavigation } from '@archivisio/c4-modelizer-sdk';
import { runLevelChange } from '@/state/levelTransition';
import { isBrokerView } from '@utils/brokerTech';
import { isDatabaseSchemaView } from '@utils/databaseTech';
import { Box, HStack } from '@chakra-ui/react';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import {
  getDocumentationEditorSession,
  subscribeDocumentationEditor,
} from '@plugins/docs-editor/uiState';
import {
  isSequenceEditorOpen,
  subscribeSequenceEditor,
} from '@plugins/sequence-editor/uiState';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGlassSurface } from '@theme/glassSurfaces';
import { frameLabel, restoreNavTrailFrame } from '@components/NavTrailBreadcrumbs';
import CrumbButton from './CrumbButton';
import NavDivider from './NavDivider';
import ProjectNameField from './ProjectNameField';
import { PILL_MIN_H } from './constants';
import { buildC4Segments, editorPathFor, frameIcon, normalizeProjectName } from './helpers';
import type { CurrentCrumb, WorkspaceNavPillProps } from './types';

export default function WorkspaceNavPill({
  projectMode = false,
  projectName,
  onRenameProject,
  viewOnly = false,
  readOnly = false,
}: WorkspaceNavPillProps) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { model } = useFlatC4Store();
  const { activeSystem, activeContainer, activeComponent } = useFlatActiveElements();
  const {
    navigateToSystem,
    navigateToContainer,
    navigateToComponent,
    navigateToCode,
  } = useFlatNavigation();

  const frames = useSyncExternalStore(
    subscribeNavTrail,
    getNavTrailSnapshot,
    () => [] as NavTrailFrame[]
  );
  const { canGoBack: canRouterBack, canGoForward: canRouterForward } = useRouterHistoryStack();
  useSyncExternalStore(subscribeDocumentationEditor, getDocumentationEditorSession, () => null);
  const sequenceOpen = useSyncExternalStore(
    subscribeSequenceEditor,
    isSequenceEditorOpen,
    () => false
  );

  const locked = Boolean(viewOnly || readOnly);
  const onCatalog = location.pathname.endsWith('/catalog');
  const onFlows = location.pathname.endsWith('/flows');
  const docsOpen = Boolean(getDocumentationEditorSession());
  /**
   * The catalog and the flows page replace the diagram, so its levels mean
   * nothing there. Documentation and sequences open *over* the diagram — the
   * level stays where it was, and hiding it made the pill change shape every
   * time one of them opened.
   */
  const hideC4 = onCatalog || onFlows;
  const overlayOpen = docsOpen || sequenceOpen;
  const schemaMode = isDatabaseSchemaView(model);
  const brokerMode = isBrokerView(model);

  /* `/editor`, not `/` — `/` is the marketing page. It only looked right
     because the landing bounces a signed-in visitor straight back here; a
     guest pressing home left the editor and did not come back. */
  const editorPath = editorPathFor(projectMode, projectId);

  const [draftName, setDraftName] = useState(projectName || '');
  useEffect(() => {
    setDraftName(projectName || '');
  }, [projectName]);

  /* The page that opened this project fetched the name once; a rename from the
     navigator has to reach us here or the pill keeps the old one. */
  useEffect(
    () =>
      subscribeProjectRename((id, name) => {
        if (id === projectId) setDraftName(name);
      }),
    [projectId]
  );

  /*
   * Clicking the canvas does not blur the name field: React Flow's pane calls
   * preventDefault on the mousedown that would otherwise move focus, so the
   * caret stayed blinking in a field the person had already left. Blur it
   * ourselves — the blur handler is what commits the rename, so the name is
   * saved by the same click that puts the field away.
   */
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = nameInputRef.current;
      if (!el || document.activeElement !== el) return;
      if (el.contains(event.target as Node)) return;
      el.blur();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  const commitName = () => {
    if (locked || !onRenameProject) return;
    const next = normalizeProjectName(draftName);
    setDraftName(next);
    if (next !== projectName) {
      void onRenameProject(next);
      if (projectId) emitProjectRenamed(projectId, next);
    }
  };

  const goHome = () => {
    leaveWorkspaceOverlays();
    if (location.pathname !== editorPath) {
      navigate(editorPath);
    }
    runLevelChange(() => {
      navigateToSystem();
      canvasFitView();
    });
  };

  /*
   * Back means one step out of wherever you are: close the thing on top, and
   * with nothing on top, climb a level of the model.
   *
   * The model climb is new because the pill no longer spells the whole path
   * out — it shows the level you are on, and this is the only way up. Level
   * changes never entered the router's history (they live in the store, not
   * the URL), so `navigate(-1)` could not have done it.
   */
  const goBack = () => {
    if (frames.length > 1) {
      const frame = popNavTrail();
      if (frame) {
        restoreNavTrailFrame(frame, {
          navigate: (to) => navigate(to),
          pathname: location.pathname,
        });
      }
      return;
    }
    if (!hideC4) {
      if (model.viewLevel === 'code') return handleComponentsClick();
      if (model.viewLevel === 'component') return handleContainersClick();
      if (model.viewLevel === 'container') return handleSystemsClick();
    }
    if (canRouterBack) {
      navigate(-1);
    }
  };

  const goForward = () => {
    const frame = forwardNavTrail();
    if (frame) {
      restoreNavTrailFrame(frame, {
        navigate: (to) => navigate(to),
        pathname: location.pathname,
      });
      return;
    }
    if (canRouterForward) {
      navigate(1);
    }
  };

  /**
   * A level crumb means "show me that diagram" — with a document or a sequence
   * open over it, that has to put the overlay away first, or the click would
   * move the canvas nobody can see.
   */
  const goToLevel = (jump: () => void) => {
    if (overlayOpen) leaveWorkspaceOverlays();
    runLevelChange(() => {
      jump();
      canvasFitView();
    });
  };

  const handleSystemsClick = () => goToLevel(() => navigateToSystem());

  const handleContainersClick = () => {
    if (!model.activeSystemId) return;
    goToLevel(() => navigateToContainer(model.activeSystemId as string));
  };

  const handleComponentsClick = () => {
    if (!model.activeSystemId || !model.activeContainerId) return;
    goToLevel(() =>
      navigateToComponent(model.activeSystemId as string, model.activeContainerId as string)
    );
  };

  const handleCodeClick = () => {
    if (!model.activeSystemId || !model.activeContainerId || !model.activeComponentId) return;
    goToLevel(() =>
      navigateToCode(
        model.activeSystemId as string,
        model.activeContainerId as string,
        model.activeComponentId as string
      )
    );
  };

  const visibleTrailFrames = frames.filter((frame) => frame.kind !== 'diagram');
  const canTrailBack = frames.length > 1;
  const canTrailForward = canForwardNavTrail();
  const canLevelUp = !hideC4 && model.viewLevel !== 'system';
  const canBack = canTrailBack || canLevelUp || canRouterBack;
  const canForward = canTrailForward || canRouterForward;

  const c4Segments = hideC4
    ? []
    : buildC4Segments({
        viewLevel: model.viewLevel,
        overlayOpen,
        schemaMode,
        brokerMode,
        activeSystemName: activeSystem?.name,
        activeContainerName: activeContainer?.name,
        activeComponentName: activeComponent?.name,
        t,
        onSystems: handleSystemsClick,
        onContainers: handleContainersClick,
        onComponents: handleComponentsClick,
        onCode: handleCodeClick,
      });

  /* Whatever is on top: a document or a sequence over the canvas, otherwise
     the level the canvas itself is showing. */
  const topFrame = visibleTrailFrames[visibleTrailFrames.length - 1];
  const topLevel = c4Segments[c4Segments.length - 1];
  const currentCrumb: CurrentCrumb | null = topFrame
    ? {
        icon: frameIcon(topFrame),
        label: frameLabel(topFrame, t),
        testId: 'nav-crumb-trail',
      }
    : topLevel
      ? { icon: topLevel.icon, label: topLevel.label, testId: `nav-crumb-${topLevel.key}` }
      : null;

  return (
    <Box pointerEvents="none" minW={0} maxW="100%">
      <HStack
        data-testid="breadcrumb"
        data-tour="top-toolbar"
        data-nav-pill
        gap="2px"
        px="8px"
        py="6px"
        minH={PILL_MIN_H}
        w="fit-content"
        maxW="100%"
        pointerEvents="auto"
        flexWrap="nowrap"
        overflow="hidden"
        {...glass.floatBar}
      >
        <ToolbarIconButton
          aria-label={t('nav_home', { defaultValue: 'Home' })}
          title={t('nav_home', { defaultValue: 'Home' })}
          onClick={goHome}
        >
          <Home size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
        <ToolbarIconButton
          aria-label={t('nav_back', { defaultValue: 'Back' })}
          title={t('nav_back', { defaultValue: 'Back' })}
          onClick={goBack}
          disabled={!canBack}
        >
          <ArrowLeft size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>
        <ToolbarIconButton
          aria-label={t('nav_forward', { defaultValue: 'Forward' })}
          title={t('nav_forward', { defaultValue: 'Forward' })}
          onClick={goForward}
          disabled={!canForward}
        >
          <ArrowRight size={TOOLBAR_ICON_SIZE} />
        </ToolbarIconButton>

        <InstrumentsMenu />

        <NavDivider />
        <PortalTarget id="navbar-before" />

        {/*
          * Where you are, not how you got here.
          *
          * The pill used to spell out the whole descent — Systems · that
          * system · that container · that component — which on a deep model is
          * a line of text longer than the toolbar, all of it about places the
          * person has already left. One crumb says the same thing about the
          * only place that is true right now, and the back arrow is the way
          * out of it.
          */}
        {currentCrumb ? (
          <HStack gap="0" minW={0} flexShrink={0}>
            <CrumbButton
              active
              icon={currentCrumb.icon}
              label={currentCrumb.label}
              title={currentCrumb.label}
              testId={currentCrumb.testId}
            />
          </HStack>
        ) : null}

        {projectMode && projectName !== undefined ? (
          <>
            <NavDivider />
            <ProjectNameField
              ref={nameInputRef}
              value={draftName}
              onChange={setDraftName}
              onCommit={commitName}
              onRevert={() => setDraftName(projectName || '')}
              disabled={locked || !onRenameProject}
              viewOnly={viewOnly}
            />
          </>
        ) : null}

        <PortalTarget id="navbar-after" />
      </HStack>

    </Box>
  );
}
