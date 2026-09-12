import { loginPagePath } from '@shared/api';
import { useCatalogProject } from '@features/service-catalog';
import type { ContainerBlock, FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import AppFooter from '@components/AppFooter';
import ConfirmDialog from '@components/common/ConfirmDialog';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import TechnologyIcon from '@components/TechnologyIcon';
import { useAuth } from '@contexts/AuthContext';
import { useColorMode } from '@contexts/ColorModeContext';
import { getTechnologyById } from '@data/technologies';
import { documentationCount } from '@plugins/docs-editor/entityDocs';
import ToolbarSlot from '@slots/ToolbarSlot';
import type { DocumentationExtras, SequenceDiagramExtras } from '@/types/c4Extensions';
import { isExternalEntity } from '@/types/c4Extensions';
import FlowParticipationList from '@components/data-flow/FlowParticipationList';
import {
  dataFlowPlaybackPath,
  flowsForElement,
  getModelDataFlows,
  initialOrBranchStepId,
  uniqueFlowsForElement,
} from '@utils/dataFlows';
import { requestDiagramFocus } from '@/navigation/diagramFocusBus';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import { openDataFlowPlayback } from '@plugins/data-flows/uiState';
import { openServiceContract } from '@components/service-contract/UiState';
import { openChannelContract } from '@components/channel-contract/UiState';
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import {
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  FileJson,
  Layers,
  LocateFixed,
  Radio,
  Search,
  Server,
  Shield,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  catalogEditorPath,
  catalogHitById,
  classifyContainer,
  groupContainersBySystem,
  listCatalogContainers,
  listContainerEndpoints,
  searchCatalogElements,
  type CatalogHit,
  type ServiceCategory,
} from '@utils/serviceCatalog';
import { containerChannels } from '@utils/channelCatalog';
import {
  channelSurfaceLabel,
  isBrokerChannel,
  normalizeChannelProtocol,
  type ChannelExtras,
} from '@/types/c4Extensions';
import { ensureNavTrailRoot, pushNavTrail, resetNavTrailToDiagram } from '@/navigation/navTrail';
import { useGlassSurface } from '@theme/glassSurfaces';
import { MANAGER_BAR_MIN_H, SIDE_PANEL_INSET, WORKSPACE_CONTENT_TOP } from '@theme/sidePanelLayout';

type Props = {
  projectMode?: boolean;
  embedded?: boolean;
  onRequestClose?: () => void;
  initialSelectedId?: string | null;
};

function catalogReturnPath(state: unknown): string | null {
  const candidates: unknown[] = [];
  if (state && typeof state === 'object') candidates.push((state as { from?: unknown }).from);
  try {
    candidates.push(sessionStorage.getItem('c4-catalog-return'));
  } catch {
    /* ignore */
  }
  for (const from of candidates) {
    if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) continue;
    if (from === '/catalog' || from.startsWith('/catalog?') || from.startsWith('/catalog#')) continue;
    return from;
  }
  return null;
}

function catalogReturnView(state: unknown):
  | { viewLevel: FlatC4Model['viewLevel']; activeSystemId?: string; activeContainerId?: string; activeComponentId?: string }
  | null {
  const candidates: unknown[] = [];
  if (state && typeof state === 'object') candidates.push((state as { returnView?: unknown }).returnView);
  try {
    const raw = sessionStorage.getItem('c4-catalog-return-view');
    if (raw) candidates.push(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const viewLevel = (item as { viewLevel?: unknown }).viewLevel;
    if (viewLevel !== 'system' && viewLevel !== 'container' && viewLevel !== 'component' && viewLevel !== 'code') {
      continue;
    }
    return {
      viewLevel,
      activeSystemId: (item as { activeSystemId?: string }).activeSystemId,
      activeContainerId: (item as { activeContainerId?: string }).activeContainerId,
      activeComponentId: (item as { activeComponentId?: string }).activeComponentId,
    };
  }
  return null;
}

const CATEGORY_ICON: Record<ServiceCategory, typeof Server> = {
  service: Server,
  database: Database,
  broker: Radio,
  gateway: Shield,
};

export default function ServiceCatalogPage({
  projectMode = false,
  embedded = false,
  onRequestClose,
  initialSelectedId,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const model = useFlatC4Store((s) => s.model);
  const setModel = useFlatC4Store((s) => s.setModel);

  const {
    projectName,
    access,
    canWrite,
    loading,
    loadError,
    handleRenameProject,
  } = useCatalogProject({
    projectMode,
    embedded,
    projectId,
    user,
    authLoading,
    setModel,
  });

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set()
  );
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (!embedded) return;
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [embedded, initialSelectedId]);

  const groups = useMemo(() => groupContainersBySystem(model), [model]);

  /* Open every category that has services — a folded "Services 7" looks empty. */
  useEffect(() => {
    if (groups.length === 0) return;
    setExpandedCategories((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const { system, categories } of groups) {
        for (const { category } of categories) {
          const key = `${system.id}:${category}`;
          if (!next.has(key)) {
            next.add(key);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [groups]);
  const hits = useMemo(
    () => (query.trim() ? searchCatalogElements(model, query) : []),
    [model, query]
  );
  const searching = Boolean(query.trim());

  const selectedContainer = useMemo(() => {
    if (!selectedId) return null;
    return listCatalogContainers(model).find((c) => c.id === selectedId) ?? null;
  }, [model, selectedId]);

  const selectedHit = useMemo(() => {
    if (!selectedId || selectedContainer) return null;
    return catalogHitById(model, selectedId);
  }, [model, selectedId, selectedContainer]);

  const diagramProjectId = projectMode ? projectId : undefined;
  const catalogPath =
    projectMode && projectId ? `/projects/${projectId}/catalog` : '/catalog';
  const returnTo = catalogReturnPath(location.state);
  const returnView = catalogReturnView(location.state);

  useEffect(() => {
    if (embedded) return;
    ensureNavTrailRoot();
    pushNavTrail({
      kind: 'catalog',
      label: t('nav_trail_catalog'),
      path: catalogPath,
      id: 'catalog',
    });
  }, [embedded, catalogPath, t]);

  const closeCatalog = useCallback(() => {
    if (embedded) {
      onRequestClose?.();
      return;
    }
    resetNavTrailToDiagram();
    navigate(returnTo || (projectMode && projectId ? `/projects/${projectId}` : '/'), {
      state: returnView ? { restoreView: returnView } : undefined,
    });
  }, [embedded, navigate, onRequestClose, projectMode, projectId, returnTo, returnView]);

  const goToDiagram = (id: string) => {
    const hit = catalogHitById(model, id);
    const container = listCatalogContainers(model).find((c) => c.id === id);
    const label = hit?.name || container?.name || id;
    pushNavTrail({
      kind: 'element',
      label,
      focusId: id,
      id: `el_${id}`,
    });
    if (embedded) {
      // Overlay sits on an already-mounted editor — URL `?focus=` alone neither
      // closes the catalog nor retriggers the canvas focus effect.
      leaveWorkspaceOverlays({ resetTrail: false });
      requestDiagramFocus(id);
    }
    navigate(catalogEditorPath(diagramProjectId, id));
  };

  const goToFlowStep = (flowId: string, stepId: string) => {
    const flow = getModelDataFlows(model).find((item) => item.id === flowId);
    const stepIndex = Math.max(0, flow?.steps.findIndex((s) => s.id === stepId) ?? 0);
    leaveWorkspaceOverlays();
    openDataFlowPlayback({
      flowId,
      stepIndex: stepIndex < 0 ? 0 : stepIndex,
      homeProjectId: diagramProjectId,
      flowSnapshot: flow,
      stepCount: flow?.steps.length,
      branchStepId: flow
        ? initialOrBranchStepId(flow.steps, stepIndex, stepId)
        : null,
      returnView: returnView ?? {
        viewLevel: model.viewLevel,
        activeSystemId: model.activeSystemId,
        activeContainerId: model.activeContainerId,
        activeComponentId: model.activeComponentId,
      },
    });
    if (!embedded) {
      navigate(dataFlowPlaybackPath(diagramProjectId, flowId, stepId));
    }
  };

  const categoryKey = (systemId: string, category: ServiceCategory) =>
    `${systemId}:${category}`;

  const toggleCategory = useCallback((systemId: string, category: ServiceCategory) => {
    const key = categoryKey(systemId, category);
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const catalogReturn = projectMode && projectId ? `/projects/${projectId}/catalog` : '/catalog';

  const searchField = (
    <Box position="relative">
      <Box
        position="absolute"
        left="12px"
        top="50%"
        transform="translateY(-50%)"
        color="fg.muted"
        pointerEvents="none"
      >
        <Search size={14} />
      </Box>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('catalog_search_placeholder')}
        pl="36px"
        h="36px"
        bg="bg.dialog"
        borderWidth="1px"
        borderColor="border.glass"
        borderRadius="md"
        _focusVisible={{ borderColor: 'border.default', boxShadow: 'none' }}
      />
    </Box>
  );

  const toolbar = (
    <ToolbarSlot
      hideTools
      model={model}
      user={user}
      projectName={projectName}
      projectMode={projectMode}
      viewOnly={projectMode && access === 'view'}
      onLogin={() => navigate(loginPagePath(catalogReturn))}
      onLogout={() => setLogoutConfirmOpen(true)}
      onRenameProject={
        projectMode && canWrite ? handleRenameProject : undefined
      }
    />
  );

  if (projectMode && authLoading) {
    return (
      <Box h={embedded ? '100%' : '100vh'} display="grid" placeItems="center" bg="bg.canvas">
        <QuackSpinner size="xl" />
      </Box>
    );
  }

  return (
    <Box
      h={embedded ? '100%' : '100vh'}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      bg={embedded ? 'transparent' : 'bg.canvas'}
      color="fg.default"
    >
      {!embedded ? (
        <ConfirmDialog
          open={logoutConfirmOpen}
          title="Log out?"
          content="You are about to leave this session. Are you sure you want to log out?"
          onCancel={() => {
            if (logoutLoading) return;
            setLogoutConfirmOpen(false);
          }}
          onConfirm={() => {
            if (logoutLoading) return;
            setLogoutLoading(true);
            void logout()
              /* No navigation here — AuthProvider sends a finished session
                 to the sign-in screen, and a second destination would race it. */
              .then(() => setLogoutConfirmOpen(false))
              .finally(() => setLogoutLoading(false));
          }}
          confirmText="Yes, log out"
          cancelText="Cancel"
          confirmLoading={logoutLoading}
        />
      ) : null}

      <Box flex="1" minH={0} position="relative" overflow="hidden" display="flex" flexDirection="column">
        {!embedded ? toolbar : null}

        {/* Same window as Magic flows and the change-set catalog: a titled
            glass bar, then the list and the detail as two cards with a gutter
            between them. */}
        <Box
          flex="1"
          minH={0}
          mt={embedded ? 0 : WORKSPACE_CONTENT_TOP}
          overflow="hidden"
          display="flex"
          flexDirection="column"
        >
          <HStack
            px="12px"
            minH={MANAGER_BAR_MIN_H}
            py="10px"
            gap="12px"
            align="center"
            justify="space-between"
            flexShrink={0}
            {...glass.floatBar}
            mx={embedded ? 0 : SIDE_PANEL_INSET}
            mt={SIDE_PANEL_INSET}
          >
            <HStack gap="8px" minW={0}>
              <Box color="fg.muted" lineHeight={0}>
                <Layers size={15} />
              </Box>
              <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                {t('catalog_title')}
              </Text>
            </HStack>
            <ToolbarIconButton
              title={t('close')}
              aria-label={t('close')}
              data-testid="catalog-close"
              onClick={closeCatalog}
            >
              <X size={TOOLBAR_ICON_SIZE} />
            </ToolbarIconButton>
          </HStack>
      {projectMode && loading ? (
        <Box
          flex="1"
          display="grid"
          placeItems="center"
          mx={embedded ? 0 : SIDE_PANEL_INSET}
          mt={SIDE_PANEL_INSET}
          mb={embedded ? 0 : SIDE_PANEL_INSET}
          {...glass.editorPanel}
        >
          <QuackSpinner size="xl" />
        </Box>
      ) : loadError === 'sign-in' ? (
        <Box
          flex="1"
          display="grid"
          placeItems="center"
          p="24px"
          mx={embedded ? 0 : SIDE_PANEL_INSET}
          mt={SIDE_PANEL_INSET}
          mb={embedded ? 0 : SIDE_PANEL_INSET}
          {...glass.editorPanel}
        >
          <Text color="fg.muted">{t('sign_in')}</Text>
        </Box>
      ) : loadError ? (
        <Box
          flex="1"
          display="grid"
          placeItems="center"
          p="24px"
          mx={embedded ? 0 : SIDE_PANEL_INSET}
          mt={SIDE_PANEL_INSET}
          mb={embedded ? 0 : SIDE_PANEL_INSET}
          {...glass.editorPanel}
        >
          <Text color="fg.muted">{loadError}</Text>
        </Box>
      ) : (
      <HStack
        align="stretch"
        flex="1"
        minH={0}
        overflow="hidden"
        gap={SIDE_PANEL_INSET}
        mx={embedded ? 0 : SIDE_PANEL_INSET}
        mt={SIDE_PANEL_INSET}
        mb={embedded ? 0 : SIDE_PANEL_INSET}
      >
        <Box
          w={{ base: '100%', md: '340px' }}
          maxW={{ md: '34%' }}
          h="100%"
          overflow="hidden"
          display={{ base: selectedId ? 'none' : 'flex', md: 'flex' }}
          flexDirection="column"
          minH={0}
          flexShrink={0}
          {...glass.editorPanel}
        >
          <Box
            px="12px"
            pt="12px"
            pb="10px"
            flexShrink={0}
            borderBottomWidth="1px"
            borderColor="border.glass"
          >
            {searchField}
          </Box>
          <Box flex="1" minH={0} overflowY="auto" p="12px" css={glass.scrollbar}>
            {searching ? (
              hits.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  {t('catalog_no_results')}
                </Text>
              ) : (
                <VStack align="stretch" gap="4px">
                  {hits.map((hit) => (
                    <CatalogRow
                      key={`${hit.kind}:${hit.id}`}
                      name={hit.name}
                      meta={hitMeta(hit, t)}
                      technology={hit.technology}
                      selected={selectedId === hit.id}
                      onClick={() => setSelectedId(hit.id)}
                      itemId={hit.id}
                    />
                  ))}
                </VStack>
              )
            ) : groups.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                {t('catalog_empty')}
              </Text>
            ) : (
              <VStack align="stretch" gap="20px">
                {groups.map(({ system, categories }) => (
                  <Box key={system.id}>
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      letterSpacing="0.04em"
                      textTransform="uppercase"
                      color="fg.muted"
                      mb="8px"
                    >
                      {system.name}
                    </Text>
                    <VStack align="stretch" gap="12px">
                      {categories.map(({ category, containers }) => {
                        const Icon = CATEGORY_ICON[category];
                        const collapsed = !expandedCategories.has(
                          categoryKey(system.id, category)
                        );
                        const label = t(`catalog_category_${category}`);
                        return (
                          <Box key={category}>
                            <HStack
                              as="button"
                              w="full"
                              gap="6px"
                              mb={collapsed ? '0' : '6px'}
                              color="fg.muted"
                              cursor="pointer"
                              borderRadius="6px"
                              px="4px"
                              py="2px"
                              mx="-4px"
                              textAlign="left"
                              _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
                              aria-expanded={!collapsed}
                              aria-label={
                                collapsed
                                  ? t('catalog_expand_category', { name: label })
                                  : t('catalog_collapse_category', { name: label })
                              }
                              onClick={() => toggleCategory(system.id, category)}
                            >
                              {collapsed ? (
                                <ChevronRight size={12} />
                              ) : (
                                <ChevronDown size={12} />
                              )}
                              <Icon size={12} />
                              <Text fontSize="xs" fontWeight="600">
                                {label}
                              </Text>
                              <Text fontSize="xs" color="fg.subtle">
                                {containers.length}
                              </Text>
                            </HStack>
                            {!collapsed ? (
                              <VStack align="stretch" gap="4px">
                                {containers.map((c) => {
                                  const flowCount = uniqueFlowsForElement(model, c.id).length;
                                  const techName = c.technology
                                    ? getTechnologyById(c.technology)?.name
                                    : undefined;
                                  const category = classifyContainer(c);
                                  const channelCount =
                                    category === 'broker'
                                      ? containerChannels(model, c.id).length
                                      : 0;
                                  const endpointCount =
                                    category === 'broker'
                                      ? 0
                                      : listContainerEndpoints(model, c.id).length;
                                  const meta = [
                                    techName,
                                    channelCount
                                      ? t('catalog_stat_channels', { count: channelCount })
                                      : endpointCount
                                        ? t('catalog_stat_endpoints', { count: endpointCount })
                                        : null,
                                    flowCount
                                      ? t('catalog_stat_flows', { count: flowCount })
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ');
                                  return (
                                  <CatalogRow
                                    key={c.id}
                                    name={c.name}
                                    meta={meta || undefined}
                                    technology={c.technology}
                                    external={isExternalEntity(c)}
                                    selected={selectedId === c.id}
                                    onClick={() => setSelectedId(c.id)}
                                    itemId={c.id}
                                  />
                                  );
                                })}
                              </VStack>
                            ) : null}
                          </Box>
                        );
                      })}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </Box>

        <Box
          flex="1"
          minW={{ md: '260px' }}
          minH={0}
          overflowY="auto"
          p="20px"
          display={{ base: selectedId ? 'block' : 'none', md: 'block' }}
          css={glass.scrollbar}
          {...glass.editorPanel}
        >
          {selectedContainer ? (
            <ServiceDetail
              model={model}
              container={selectedContainer}
              onShow={goToDiagram}
              onOpenFlowStep={goToFlowStep}
              onBack={() => setSelectedId(null)}
            />
          ) : selectedHit ? (
            <HitDetail
              model={model}
              hit={selectedHit}
              onShow={goToDiagram}
              onOpenFlowStep={goToFlowStep}
              onOpenService={
                selectedHit.containerId
                  ? () => setSelectedId(selectedHit.containerId!)
                  : undefined
              }
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <Box maxW="520px" color="fg.muted" pt="24px">
              <Layers size={28} />
              <Heading as="h2" size="md" mt="12px" mb="8px" color="fg.default">
                {t('catalog_title')}
              </Heading>
              <Text fontSize="sm" lineHeight="1.7">
                {t('catalog_intro')}
              </Text>
            </Box>
          )}
        </Box>
      </HStack>
      )}
        </Box>
      {!embedded ? <AppFooter variant="bar" /> : null}
      </Box>
    </Box>
  );
}

function hitMeta(hit: CatalogHit, t: (k: string) => string): string {
  const bits = [t(`catalog_kind_${hit.kind}`)];
  if (hit.kind === 'component' && hit.containerName) bits.push(hit.containerName);
  else if (hit.systemName && hit.kind !== 'system') bits.push(hit.systemName);
  return bits.join(' · ');
}

function CatalogRow({
  name,
  meta,
  technology,
  external,
  selected,
  onClick,
  itemId,
}: {
  name: string;
  meta?: string;
  technology?: string;
  external?: boolean;
  selected: boolean;
  onClick: () => void;
  itemId: string;
}) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  return (
    <Box
      as="button"
      textAlign="left"
      w="full"
      px="10px"
      py="8px"
      borderRadius="8px"
      borderWidth="1px"
      borderColor={selected ? 'border.emphasized' : 'transparent'}
      bg={selected ? chrome.listSelected : 'transparent'}
      _hover={{ bg: 'bg.list.hover' }}
      cursor="pointer"
      onClick={onClick}
    >
      <HStack gap="8px" align="center">
        {technology ? (
          <TechnologyIcon
            item={{ id: itemId, name, technology, type: 'container', position: { x: 0, y: 0 } }}
            size={18}
            showTooltip={false}
          />
        ) : (
          <Box w="18px" />
        )}
        <Box minW={0} flex="1">
          <HStack gap="6px">
            <Text fontSize="sm" fontWeight="600" lineClamp={1}>
              {name}
            </Text>
            {external ? (
              <Badge size="sm" variant="outline">
                {t('catalog_external')}
              </Badge>
            ) : null}
          </HStack>
          {meta ? (
            <Text fontSize="xs" color="fg.muted" lineClamp={1}>
              {meta}
            </Text>
          ) : null}
        </Box>
      </HStack>
    </Box>
  );
}

function ServiceDetail({
  model,
  container,
  onShow,
  onOpenFlowStep,
  onBack,
}: {
  model: FlatC4Model;
  container: ContainerBlock;
  onShow: (id: string) => void;
  onOpenFlowStep: (flowId: string, stepId: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const system = model.systems.find((s) => s.id === container.systemId);
  const tech = container.technology ? getTechnologyById(container.technology) : undefined;
  const category = classifyContainer(container);
  const isBroker = category === 'broker';
  const endpoints = isBroker ? [] : listContainerEndpoints(model, container.id);
  const channels = isBroker ? containerChannels(model, container.id) : [];
  const components = model.components.filter((c) => c.containerId === container.id && !c.original);
  const docs = documentationCount(container as DocumentationExtras);
  const sequences = (container as SequenceDiagramExtras).sequenceDiagrams?.length ?? 0;
  const flowHits = flowsForElement(model, container.id);
  const flowCount = uniqueFlowsForElement(model, container.id).length;
  const connections = (container.connections ?? [])
    .map((conn) => {
      const target =
        model.containers.find((c) => c.id === conn.targetId) ||
        model.systems.find((s) => s.id === conn.targetId);
      return {
        id: conn.targetId,
        name: target?.name || conn.targetId,
        label: conn.label,
        technology: conn.technology,
      };
    });

  return (
    <Box maxW="720px">
      <Button
        size="xs"
        variant="ghost"
        mb="12px"
        display={{ base: 'inline-flex', md: 'none' }}
        onClick={onBack}
      >
        {t('catalog_back_to_list')}
      </Button>
      <HStack gap="10px" align="center" mb="6px">
        {container.technology ? (
          <TechnologyIcon item={container} size={28} showTooltip={false} />
        ) : null}
        <Heading as="h2" size="lg">
          {container.name}
        </Heading>
        {isExternalEntity(container) ? <Badge>{t('catalog_external')}</Badge> : null}
      </HStack>
      <HStack gap="8px" flexWrap="wrap" mb="16px" color="fg.muted" fontSize="sm">
        <Text>{t(`catalog_category_${category}`)}</Text>
        {tech ? <Text>· {tech.name}</Text> : null}
        {system ? <Text>· {system.name}</Text> : null}
      </HStack>

      {container.description ? (
        <Text fontSize="sm" lineHeight="1.7" mb="16px" whiteSpace="pre-wrap">
          {container.description}
        </Text>
      ) : (
        <Text fontSize="sm" color="fg.muted" mb="16px">
          {t('catalog_no_description')}
        </Text>
      )}

      {container.url?.trim() ? (
        <Link
          href={container.url}
          target="_blank"
          rel="noopener noreferrer"
          fontSize="sm"
          mb="16px"
          display="inline-flex"
          alignItems="center"
          gap="6px"
        >
          <ExternalLink size={14} />
          {container.url}
        </Link>
      ) : null}

      <HStack gap="8px" mb="20px" flexWrap="wrap">
        <Badge variant="outline">
          {t('catalog_stat_components', { count: components.length })}
        </Badge>
        {isBroker ? (
          <Badge variant="outline">
            {t('catalog_stat_channels', { count: channels.length })}
          </Badge>
        ) : (
          <Badge variant="outline">
            {t('catalog_stat_endpoints', { count: endpoints.length })}
          </Badge>
        )}
        <Badge variant="outline">{t('catalog_stat_docs', { count: docs })}</Badge>
        <Badge variant="outline">{t('catalog_stat_sequences', { count: sequences })}</Badge>
        <Badge variant="outline">{t('catalog_stat_flows', { count: flowCount })}</Badge>
      </HStack>

      <Button onClick={() => onShow(container.id)} colorPalette="brand">
        <LocateFixed size={16} />
        {t('catalog_show_on_diagram')}
      </Button>

      <Box mt="28px">
        <Text fontSize="sm" fontWeight="700" mb="8px">
          {t('data_flow_on_service', { count: flowCount })}
        </Text>
        <FlowParticipationList participations={flowHits} onOpenStep={onOpenFlowStep} />
      </Box>

      {endpoints.length > 0 ? (
        <Box mt="28px">
          <Text fontSize="sm" fontWeight="700" mb="8px">
            {t('catalog_endpoints')}
          </Text>
          {/* One way in rather than a second list of paths: the contract window
              shows the same endpoints with everything they actually promise. */}
          <Button
            size="sm"
            variant="outline"
            borderColor="border.strong"
            onClick={() =>
              openServiceContract({
                containerId: container.id,
                containerName: container.name,
              })
            }
            data-testid="catalog-open-contract"
          >
            <FileJson size={14} />
            {t('catalog_open_contract', { count: endpoints.length })}
          </Button>
        </Box>
      ) : null}

      {channels.length > 0 ? (
        <Box mt="28px">
          <Text fontSize="sm" fontWeight="700" mb="8px">
            {t('catalog_channels')}
          </Text>
          {/* Same entry as the canvas badge: the channel contract viewer lists
              every topic/queue with key / value / headers schemas. */}
          <Button
            size="sm"
            variant="outline"
            borderColor="border.strong"
            onClick={() =>
              openChannelContract({
                containerId: container.id,
                containerName: container.name,
              })
            }
            data-testid="catalog-open-channel-contract"
          >
            <Radio size={14} />
            {t('catalog_open_channel_contract', { count: channels.length })}
          </Button>
        </Box>
      ) : null}

      {connections.length > 0 ? (
        <Box mt="28px">
          <Text fontSize="sm" fontWeight="700" mb="8px">
            {t('catalog_connections')}
          </Text>
          <VStack align="stretch" gap="4px">
            {connections.map((c, i) => (
              <Text key={`${c.id}-${i}`} fontSize="sm" color="fg.muted">
                {c.label ? `${c.label} → ${c.name}` : c.name}
                {c.technology ? ` (${c.technology})` : ''}
              </Text>
            ))}
          </VStack>
        </Box>
      ) : null}
    </Box>
  );
}

function HitDetail({
  model,
  hit,
  onShow,
  onOpenService,
  onOpenFlowStep,
  onBack,
}: {
  model: FlatC4Model;
  hit: CatalogHit;
  onShow: (id: string) => void;
  onOpenService?: () => void;
  onOpenFlowStep: (flowId: string, stepId: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  if (hit.kind === 'container') {
    const container = model.containers.find((c) => c.id === hit.id);
    if (container) {
      return (
        <ServiceDetail
          model={model}
          container={container}
          onShow={onShow}
          onOpenFlowStep={onOpenFlowStep}
          onBack={onBack}
        />
      );
    }
  }

  const component = hit.kind === 'component' ? model.components.find((c) => c.id === hit.id) : null;
  const extras = component as
    | (typeof component & { method?: string; endpoint?: string } & ChannelExtras)
    | null;
  const isChannel = Boolean(component && isBrokerChannel(component));
  const broker =
    isChannel && component?.containerId
      ? model.containers.find((c) => c.id === component.containerId)
      : null;
  const channelProtocol = isChannel
    ? normalizeChannelProtocol(extras?.protocol)
    : null;

  return (
    <Box maxW="720px">
      <Button
        size="xs"
        variant="ghost"
        mb="12px"
        display={{ base: 'inline-flex', md: 'none' }}
        onClick={onBack}
      >
        {t('catalog_back_to_list')}
      </Button>
      <Heading as="h2" size="lg" mb="6px">
        {hit.name}
      </Heading>
      <Text fontSize="sm" color="fg.muted" mb="12px">
        {hitMeta(hit, t)}
      </Text>
      {extras?.endpoint ? (
        <Text fontFamily="mono" fontSize="sm" mb="12px">
          {extras.method || '*'} {extras.endpoint}
        </Text>
      ) : null}
      {isChannel && channelProtocol ? (
        <Text fontFamily="mono" fontSize="sm" mb="12px" color="fg.muted">
          {channelProtocol} · {channelSurfaceLabel(channelProtocol)}
          {extras?.schemaFormat ? ` · ${extras.schemaFormat}` : ''}
        </Text>
      ) : null}
      {hit.description ? (
        <Text fontSize="sm" lineHeight="1.7" mb="16px" whiteSpace="pre-wrap">
          {hit.description}
        </Text>
      ) : null}
      <HStack gap="8px" flexWrap="wrap">
        <Button onClick={() => onShow(hit.id)} colorPalette="brand">
          <LocateFixed size={16} />
          {t('catalog_show_on_diagram')}
        </Button>
        {onOpenService && hit.kind === 'component' && !isChannel ? (
          <Button variant="outline" onClick={onOpenService}>
            {t('catalog_open_service')}
          </Button>
        ) : null}
        {isChannel && broker ? (
          <Button
            variant="outline"
            onClick={() =>
              openChannelContract({
                containerId: broker.id,
                containerName: broker.name,
                channelId: component!.id,
              })
            }
            data-testid="catalog-open-channel-contract-hit"
          >
            <Radio size={14} />
            {t('catalog_open_channel_contract', {
              count: containerChannels(model, broker.id).length,
            })}
          </Button>
        ) : null}
      </HStack>
    </Box>
  );
}
