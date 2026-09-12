import { useGlassSurface, GLASS_RADIUS_BAR } from '@theme/glassSurfaces';
import { leaveCatalogOrFlows } from '@/navigation/leaveCatalogOrFlows';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import {
  closeDataFlowManager,
  getDataFlowManager,
  openDataFlowManager,
  subscribeDataFlowPlayback,
} from '@plugins/data-flows/uiState';
import {
  closeCatalogOverlay,
  getCatalogOverlay,
  openCatalogOverlay,
  subscribeCatalogOverlay,
} from '@plugins/service-catalog/uiState';
import {
  getDocumentationContext,
  getDocumentationEditorSession,
  isDocumentationEditorVisible,
  openDocumentationManager,
  setDocumentationEditorHidden,
  subscribeDocumentationEditor,
} from '@plugins/docs-editor/uiState';
import { goToNavTrail, getNavTrailSnapshot } from '@/navigation/navTrail';
import { restoreNavTrailFrame } from '@components/NavTrailBreadcrumbs';
import {
  getSequenceEditorCanEdit,
  isSequenceEditorOpen,
  openSequenceManager,
  subscribeSequenceEditor,
} from '@plugins/sequence-editor/uiState';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { CANVAS_CHROME_Z } from '@theme/sidePanelLayout';
import { ChevronDown, FileText, GitBranch, Layers, Route, Wrench } from 'lucide-react';
import { Box, Button, HStack, Portal, Text } from '@chakra-ui/react';
import InstrumentsMenuRow from './InstrumentsMenuRow';
import {
  CATALOG_RETURN_KEY,
  FLOWS_RETURN_KEY,
  INSTRUMENTS_CHEVRON_SIZE,
  INSTRUMENTS_ITEM_ICON_SIZE,
  INSTRUMENTS_MENU_DROP_GAP_PX,
  INSTRUMENTS_MENU_MIN_WIDTH,
  INSTRUMENTS_TRIGGER_ICON_SIZE,
} from './constants';
import { rememberReturnTo } from './helpers';
import type { InstrumentsMenuItem } from './types';

export default function InstrumentsMenu() {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);

  const catalogOverlay = useSyncExternalStore(subscribeCatalogOverlay, getCatalogOverlay, () => null);
  const flowManager = useSyncExternalStore(subscribeDataFlowPlayback, getDataFlowManager, () => null);
  const docsVisible = useSyncExternalStore(
    subscribeDocumentationEditor,
    isDocumentationEditorVisible,
    () => false
  );
  const docsPeeking = useSyncExternalStore(
    subscribeDocumentationEditor,
    () => {
      const session = getDocumentationEditorSession();
      return Boolean(session?.hidden);
    },
    () => false
  );
  const canEditDocs = useSyncExternalStore(
    subscribeDocumentationEditor,
    () => getDocumentationContext()?.canEdit !== false,
    () => true
  );
  const seqOpen = useSyncExternalStore(subscribeSequenceEditor, isSequenceEditorOpen, () => false);
  const seqCanEdit = useSyncExternalStore(
    subscribeSequenceEditor,
    getSequenceEditorCanEdit,
    getSequenceEditorCanEdit
  );

  const onCatalog = Boolean(catalogOverlay);
  const onFlows = Boolean(flowManager);
  const returnTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setDropRect(rect);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = () => setOpen((v) => !v);

  const handleDocs = useCallback(() => {
    if (docsPeeking) {
      const trail = getNavTrailSnapshot();
      const docFrame = [...trail].reverse().find((frame) => frame.kind === 'documentation');
      if (docFrame) {
        const restored = goToNavTrail(docFrame.id);
        if (restored) {
          restoreNavTrailFrame(restored, {
            navigate: (to) => navigate(to),
            pathname: location.pathname,
          });
        }
      } else {
        setDocumentationEditorHidden(false);
      }
      setOpen(false);
      return;
    }
    const ctx = getDocumentationContext();
    leaveWorkspaceOverlays({ resetTrail: true });
    leaveCatalogOrFlows(location.pathname, navigate);
    openDocumentationManager({
      projectId: ctx?.mode === 'cloud' && ctx.projectId ? ctx.projectId : 'local',
      canEdit: ctx?.canEdit ?? true,
    });
    setOpen(false);
  }, [docsPeeking, location.pathname, navigate]);

  const handleSeq = useCallback(() => {
    if (seqOpen) return;
    leaveCatalogOrFlows(location.pathname, navigate);
    leaveWorkspaceOverlays({ resetTrail: true });
    openSequenceManager({ readOnly: !seqCanEdit });
    setOpen(false);
  }, [seqCanEdit, seqOpen, location.pathname, navigate]);

  const handleFlows = useCallback(() => {
    if (onFlows) {
      closeDataFlowManager();
    } else {
      leaveWorkspaceOverlays();
      rememberReturnTo(FLOWS_RETURN_KEY, returnTo);
      leaveCatalogOrFlows(location.pathname, navigate);
      openDataFlowManager();
    }
    setOpen(false);
  }, [onFlows, returnTo, location.pathname, navigate]);

  const handleCatalog = useCallback(() => {
    if (onCatalog) {
      closeCatalogOverlay();
    } else {
      leaveWorkspaceOverlays();
      rememberReturnTo(CATALOG_RETURN_KEY, returnTo);
      openCatalogOverlay();
    }
    setOpen(false);
  }, [onCatalog, returnTo]);

  const items: InstrumentsMenuItem[] = [
    {
      key: 'docs',
      icon: <FileText size={INSTRUMENTS_ITEM_ICON_SIZE} />,
      label: t('documentation_project', { defaultValue: 'Documentation' }),
      active: docsVisible,
      disabled: docsVisible,
      hint: canEditDocs ? undefined : t('view_only'),
      onClick: handleDocs,
    },
    {
      key: 'seq',
      icon: <GitBranch size={INSTRUMENTS_ITEM_ICON_SIZE} />,
      label: t('sequence_open_editor', { defaultValue: 'Sequence Diagram' }),
      active: seqOpen,
      disabled: seqOpen,
      hint: seqCanEdit ? undefined : t('view_only'),
      onClick: handleSeq,
    },
    {
      key: 'flows',
      icon: <Route size={INSTRUMENTS_ITEM_ICON_SIZE} />,
      label: t('data_flow_title', { defaultValue: 'Magic Flows' }),
      active: onFlows,
      onClick: handleFlows,
    },
    {
      key: 'catalog',
      icon: <Layers size={INSTRUMENTS_ITEM_ICON_SIZE} />,
      label: t('catalog_title', { defaultValue: 'Service Catalog' }),
      active: onCatalog,
      onClick: handleCatalog,
    },
  ];

  const hasActive = items.some((i) => i.active);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="xs"
        h="28px"
        minH="28px"
        minW="28px"
        px="8px"
        borderRadius={GLASS_RADIUS_BAR}
        flexShrink={0}
        color={hasActive || open ? 'fg.default' : 'fg.muted'}
        fontWeight={hasActive || open ? '600' : '500'}
        fontSize="sm"
        bg={hasActive || open ? 'bg.list.selected' : 'transparent'}
        _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
        onClick={handleToggle}
        aria-expanded={open}
        aria-label="Instruments"
        title="Instruments"
      >
        <HStack gap="4px">
          <Box as="span" lineHeight={0} flexShrink={0}>
            <Wrench size={INSTRUMENTS_TRIGGER_ICON_SIZE} />
          </Box>
          <Text as="span" data-nav-label="">
            Instruments
          </Text>
          <Box as="span" data-nav-label="" lineHeight={0} display="inline-flex">
            <ChevronDown size={INSTRUMENTS_CHEVRON_SIZE} />
          </Box>
        </HStack>
      </Button>

      {open && dropRect && (
        <Portal>
          <Box
            ref={menuRef}
            position="fixed"
            top={`${dropRect.bottom + INSTRUMENTS_MENU_DROP_GAP_PX}px`}
            left={`${dropRect.left}px`}
            zIndex={CANVAS_CHROME_Z + 100}
            minW={INSTRUMENTS_MENU_MIN_WIDTH}
            py="4px"
            overflow="hidden"
            overflowX="hidden"
            {...glass.floatBar}
          >
            {items.map((item) => (
              <InstrumentsMenuRow key={item.key} item={item} />
            ))}
          </Box>
        </Portal>
      )}
    </>
  );
}
