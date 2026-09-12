import {
  SearchResultRow,
  SearchResultSkeletonRows,
  SEARCH_SKELETON_ROWS,
} from '@components/search/SearchResultsUi';
import { chromeSearchInputProps } from '@components/search/ChromeSearchInput';
import { fetchDomainElements } from '@features/domains';
import { useAuth } from '@contexts/AuthContext';
import { useDialogs } from '@contexts/DialogContext';
import { stampAuditCreate } from '@utils/audit';
import { findDomain, getElementDomainId } from '@utils/domains';
import type { CloneOriginalRef } from '@/types/c4Extensions';
import { trackProductEvent } from '@/metrics';
import { isGuestUser } from '@shared/api';
import { Search, X } from 'lucide-react';
import { Box, HStack, IconButton, Input, Text, VStack } from '@chakra-ui/react';
import {
  BaseBlock,
  useFlatC4Store,
  useFlatModelActions,
  useFlatSearch,
  useFlatStore,
} from '@archivisio/c4-modelizer-sdk';
import { useGlassSurface } from '@theme/glassSurfaces';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { isDuckHopActive, subscribeDuckHop } from '@/state/duckHopGame';
import {
  KIND_LABEL,
  NODE_HEIGHT,
  NODE_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_WIDTH_PX,
  PANEL_Z,
  RESULTS_MAX_HEIGHT,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_CHARS,
  SEARCH_MORE_SKELETON_ROWS,
  SEARCH_PAGE_SIZE,
} from './constants';
import {
  handleIdOf,
  hasConnectionTo,
  isNearBottom,
  mirrorTargetHandleFromSource,
  pointerClientPosition,
} from './helpers';
import type { NewConnectionData, RemoteHit } from './types';

const SearchNodeBar: React.FC = () => {
  const { setSearchValue, searchResults } = useFlatSearch();
  const { pendingConnection, setPendingConnection } = useDialogs();
  const { addElement } = useFlatModelActions();
  const { getBlockById } = useFlatStore();
  const { user } = useAuth();
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { screenToFlowPosition } = useReactFlow();
  const {
    model,
    connectSystems,
    connectContainers,
    connectComponents,
    connectCodeElements,
  } = useFlatC4Store();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [remoteHits, setRemoteHits] = useState<RemoteHit[]>([]);
  const [remoteHasMore, setRemoteHasMore] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remotePending, setRemotePending] = useState(false);
  const [localVisible, setLocalVisible] = useState(SEARCH_PAGE_SIZE);
  const [revealed, setRevealed] = useState(false);
  /* Guards against a slow earlier page landing after a newer one. */
  const remoteRequestRef = useRef(0);
  const duckHopActive = useSyncExternalStore(subscribeDuckHop, isDuckHopActive);
  const guestSession = isGuestUser(user);

  useEffect(() => {
    if (!duckHopActive || !pendingConnection) return;
    setPendingConnection(null);
  }, [duckHopActive, pendingConnection, setPendingConnection]);

  useEffect(() => {
    if (!guestSession || !pendingConnection) return;
    setPendingConnection(null);
  }, [guestSession, pendingConnection, setPendingConnection]);

  const trimmedQuery = query.trim();
  const queryActive = trimmedQuery.length >= SEARCH_MIN_CHARS;

  const dropScreen = useMemo(() => {
    if (!pendingConnection) return null;
    return pointerClientPosition(pendingConnection.event);
  }, [pendingConnection]);

  const level =
    model.viewLevel === 'system' || model.viewLevel === 'container'
      ? model.viewLevel
      : null;

  const connectionState = pendingConnection?.connectionState;
  const sourceNodeId = connectionState?.fromNode?.id;
  const sourceNode = connectionState?.fromNode?.data as BaseBlock | undefined;

  const localResults = useMemo(
    () => searchResults.filter((item) => item.id !== sourceNodeId),
    [searchResults, sourceNodeId]
  );
  const localIds = useMemo(() => new Set(localResults.map((r) => r.id)), [localResults]);

  /* Prefer other domains: an element already listed locally is not repeated. */
  const visibleRemoteHits = useMemo(
    () => remoteHits.filter((hit) => !(hit.projectId === projectId && localIds.has(hit.id))),
    [remoteHits, projectId, localIds]
  );

  /* The bar stays mounted between connections, so each new one starts clean. */
  useEffect(() => {
    setQuery('');
    setRevealed(false);
    if (inputRef.current) inputRef.current.value = '';
    requestAnimationFrame(() => setRevealed(true));
  }, [pendingConnection]);

  useEffect(() => {
    if (!pendingConnection) return;
    inputRef.current?.focus();
  }, [pendingConnection]);

  /* Capture phase: React Flow panes stop propagation on pointerdown. */
  useEffect(() => {
    if (!pendingConnection) return;
    const onDown = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setPendingConnection(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [pendingConnection, setPendingConnection]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const sync = () => setQuery(el.value);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingConnection(null);
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('input', sync);
      el.removeEventListener('change', sync);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [pendingConnection, setPendingConnection]);

  /* The SDK matches on a single character, which dumps the whole model into the
     list. It only ever sees a query worth answering. */
  const setSearchValueRef = useRef(setSearchValue);
  setSearchValueRef.current = setSearchValue;
  useEffect(() => {
    setSearchValueRef.current(queryActive ? trimmedQuery : '');
  }, [queryActive, trimmedQuery]);

  const loadRemotePage = useCallback(
    (offset: number) => {
      if (!level || !user || !queryActive) return;
      const requestId = remoteRequestRef.current;
      setRemoteLoading(true);
      void fetchDomainElements(queryClient, {
          level,
          q: trimmedQuery,
          limit: SEARCH_PAGE_SIZE,
          offset,
        })
        .then(({ elements, hasMore }) => {
          if (remoteRequestRef.current !== requestId) return;
          setRemoteHits((prev) =>
            offset === 0
              ? (elements as RemoteHit[])
              : [...prev, ...(elements as RemoteHit[])]
          );
          setRemoteHasMore(hasMore);
        })
        .catch(() => {
          if (remoteRequestRef.current !== requestId) return;
          if (offset === 0) setRemoteHits([]);
          setRemoteHasMore(false);
        })
        .finally(() => {
          if (remoteRequestRef.current === requestId) {
            setRemoteLoading(false);
            setRemotePending(false);
          }
        });
    },
    [level, user, queryActive, trimmedQuery, queryClient]
  );

  /* A new query starts a new list: drop what was loaded, then fetch page one. */
  useEffect(() => {
    remoteRequestRef.current += 1;
    setRemoteHits([]);
    setRemoteHasMore(false);
    setRemoteLoading(false);
    setLocalVisible(SEARCH_PAGE_SIZE);
    if (!pendingConnection || !queryActive) {
      setRemotePending(false);
      return;
    }
    if (user && level) setRemotePending(true);
    const timer = window.setTimeout(() => loadRemotePage(0), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pendingConnection, queryActive, trimmedQuery, level, loadRemotePage, user]);

  const canLoadMore =
    localVisible < localResults.length || (remoteHasMore && !remoteLoading);

  const loadMore = useCallback(() => {
    if (localVisible < localResults.length) {
      setLocalVisible((v) => v + SEARCH_PAGE_SIZE);
      return;
    }
    if (remoteHasMore && !remoteLoading) loadRemotePage(remoteHits.length);
  }, [localVisible, localResults.length, remoteHasMore, remoteLoading, remoteHits.length, loadRemotePage]);

  const handleResultsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!canLoadMore) return;
    if (!isNearBottom(event.currentTarget)) return;
    loadMore();
  };

  if (!pendingConnection || !dropScreen || !connectionState) return null;

  const shownLocal = localResults.slice(0, localVisible);
  const resultFound = shownLocal.length > 0 || visibleRemoteHits.length > 0;
  const awaitingRemote = Boolean(user && level && queryActive && (remotePending || remoteLoading));
  const showEmpty = queryActive && !resultFound && !awaitingRemote;
  const sourceKindLabel = sourceNode?.type ? t(KIND_LABEL[sourceNode.type] ?? sourceNode.type) : '';

  const wireClone = (
    snapshot: Record<string, unknown>,
    original: CloneOriginalRef
  ) => {
    if (!connectionState.fromNode?.id) return;

    const srcId = connectionState.fromNode.id;
    const id = crypto.randomUUID();
    const flow = screenToFlowPosition(dropScreen);

    addElement({
      ...snapshot,
      ...stampAuditCreate(user),
      id,
      position: {
        x: flow.x - NODE_WIDTH / 2,
        y: flow.y - NODE_HEIGHT / 2,
      },
      original,
    });
    trackProductEvent('editor.clone_created', {
      level: original.type,
      remote: Boolean(original.projectId),
    });

    const sourceHandle = handleIdOf(connectionState.fromHandle);
    const targetHandle = mirrorTargetHandleFromSource(sourceHandle);

    const connectionData: NewConnectionData = {
      targetId: id,
      description: '',
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
    };

    const connect = {
      system: connectSystems,
      container: connectContainers,
      component: connectComponents,
      code: connectCodeElements,
    }[model.viewLevel];

    if (connect) {
      connect(srcId, connectionData);
      /* Handles the SDK does not recognise take the connection down with them,
         so an unwired clone is retried without them. */
      const landed = hasConnectionTo(
        useFlatC4Store.getState().model,
        model.viewLevel,
        srcId,
        id
      );
      if (!landed) connect(srcId, { targetId: id, description: '' });
    }

    setPendingConnection(null);
  };

  const handleSelectResult = (result: BaseBlock) => {
    const fullHit = getBlockById(result.id) as
      | (BaseBlock & { original?: { id: string; type: string; projectId?: string } })
      | null;
    const sourceForClone = fullHit?.original?.id
      ? ((getBlockById(fullHit.original.id) as BaseBlock | null) ?? fullHit)
      : (fullHit ?? result);
    const {
      id: originalId,
      position: _omitPosition,
      original: _omitOriginal,
      ...resultSnapshot
    } = sourceForClone as BaseBlock & {
      original?: { id: string; type: string; projectId?: string };
    };
    void _omitPosition;
    void _omitOriginal;

    const targetDomainId = getElementDomainId(sourceForClone);
    const targetDomain = targetDomainId ? findDomain(model, targetDomainId) : null;
    const sourceDomainId = sourceNode ? getElementDomainId(sourceNode) : '';
    const crossDomain = Boolean(targetDomainId && targetDomainId !== sourceDomainId);

    wireClone(resultSnapshot as Record<string, unknown>, {
      id: originalId,
      type: result.type,
      ...(fullHit?.original?.projectId
        ? { projectId: fullHit.original.projectId }
        : {}),
      ...(crossDomain && targetDomain
        ? { domainId: targetDomain.id, domainName: targetDomain.name }
        : {}),
    });
  };

  const handleSelectRemote = (hit: RemoteHit) => {
    wireClone(
      {
        name: hit.name,
        description: hit.description || '',
        technology: hit.technology || '',
        type: hit.type,
        ...(hit.systemId ? { systemId: hit.systemId } : {}),
        ...(model.viewLevel === 'container' && model.activeSystemId
          ? { systemId: model.activeSystemId }
          : {}),
      },
      {
        id: hit.id,
        type: hit.type,
        ...(hit.projectId !== projectId
          ? { projectId: hit.projectId, projectName: hit.projectName }
          : {}),
        domainId: hit.domainId,
        domainName: hit.domainName,
      }
    );
  };

  return (
    <Box
      ref={rootRef}
      position="absolute"
      zIndex={PANEL_Z}
      top={`${dropScreen.y}px`}
      left={`${dropScreen.x}px`}
      transform="translate(-50%, 12px)"
      className="nopan nodrag"
      data-testid="connect-search-bar"
    >
      <Box
        w={`${PANEL_WIDTH_PX}px`}
        maxW={PANEL_MAX_WIDTH}
        overflow="hidden"
        opacity={revealed ? 1 : 0}
        transform={revealed ? 'translateY(0)' : 'translateY(-8px)'}
        transition="opacity 0.18s ease, transform 0.18s ease"
        {...glass.dialog}
      >
        <HStack
          px="10px"
          py="8px"
          gap="8px"
          borderBottomWidth="1px"
          borderColor="border.glass"
        >
          <Box color="fg.subtle" lineHeight={0} flexShrink={0}>
            <Search size={15} />
          </Box>
          <Box
            flex="1"
            minW={0}
            overflow="hidden"
            w={revealed ? 'full' : '0px'}
            transition="width 0.18s ease"
          >
            <Input
              ref={inputRef}
              {...chromeSearchInputProps}
              w="full"
              autoComplete="off"
              placeholder={t('connect_search_placeholder')}
            />
          </Box>
          <IconButton
            size="xs"
            variant="ghost"
            color="fg.muted"
            aria-label={t('close')}
            onClick={() => setPendingConnection(null)}
          >
            <X size={15} />
          </IconButton>
        </HStack>

        {sourceNode?.name ? (
          <Text fontSize="xs" color="fg.muted" px="12px" py="6px" borderBottomWidth="1px" borderColor="border.glass">
            {t('connect_search_from', { name: sourceNode.name })}
            {sourceKindLabel ? ` · ${sourceKindLabel}` : ''}
          </Text>
        ) : null}

        {query.length > 0 ? (
          <Box
            maxH={RESULTS_MAX_HEIGHT}
            overflowY="auto"
            onScroll={handleResultsScroll}
            p="6px"
            css={glass.scrollbar}
          >
            {!queryActive ? (
              <Text fontSize="sm" color="fg.muted" px="10px" py="14px">
                {t('connect_search_min_chars', { count: SEARCH_MIN_CHARS })}
              </Text>
            ) : showEmpty ? (
              <Text fontSize="sm" color="fg.muted" px="10px" py="14px">
                {t('connect_search_empty')}
              </Text>
            ) : (
              <VStack align="stretch" gap="1px">
                {shownLocal.length > 0 ? (
                  <Text fontSize="xs" fontWeight="600" color="fg.muted" px="10px" py="6px">
                    {t('global_search_local')}
                  </Text>
                ) : null}
                {shownLocal.map((item) => (
                  <SearchResultRow
                    key={item.id}
                    name={item.name}
                    technology={item.technology}
                    kindLabel={t(KIND_LABEL[item.type] ?? item.type)}
                    onClick={() => handleSelectResult(item)}
                  />
                ))}

                {user && level && (visibleRemoteHits.length > 0 || awaitingRemote) ? (
                  <>
                    <Text fontSize="xs" fontWeight="600" color="fg.muted" px="10px" py="6px" mt="4px">
                      {t('global_search_related')}
                    </Text>
                    {visibleRemoteHits.map((hit) => (
                      <SearchResultRow
                        key={`${hit.projectId}:${hit.id}`}
                        name={hit.name}
                        technology={hit.technology}
                        kindLabel={t(KIND_LABEL[hit.type])}
                        meta={t('domain_remote_project', {
                          project: hit.projectName,
                          domain: hit.domainName,
                        })}
                        onClick={() => handleSelectRemote(hit)}
                      />
                    ))}
                    {awaitingRemote ? (
                      <SearchResultSkeletonRows
                        count={
                          visibleRemoteHits.length > 0
                            ? SEARCH_MORE_SKELETON_ROWS
                            : SEARCH_SKELETON_ROWS
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </VStack>
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

export default SearchNodeBar;
