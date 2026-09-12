import { fetchWorkspaceSearch } from '@features/domains';
import { requestDiagramFocus } from '@/navigation/diagramFocusBus';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import {
  SearchResultRow,
  SearchResultSkeletonRows,
  SEARCH_SKELETON_ROWS,
} from '@components/search/SearchResultsUi';
import { chromeSearchInputProps } from '@components/search/ChromeSearchInput';
import { buildElementSearchIndex, searchElementIndex } from '@utils/elementSearch';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Input, Text, VStack } from '@chakra-ui/react';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_MORE_SKELETON_ROWS,
  GLOBAL_SEARCH_PAGE_SIZE,
  KIND_LABEL,
  RESULTS_PANEL_MAX_HEIGHT,
  RESULTS_PANEL_MAX_WIDTH,
  RESULTS_PANEL_WIDTH,
  SEARCH_INPUT_WIDTH,
} from './constants';
import { isNearBottom, resultMeta } from './helpers';
import type { GlobalSearchBarProps, RelatedHit } from './types';

export default function GlobalSearchBar({ projectName }: GlobalSearchBarProps) {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const glass = useGlassSurface();
  const model = useFlatC4Store((s) => s.model);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [localVisible, setLocalVisible] = useState(GLOBAL_SEARCH_PAGE_SIZE);
  const [relatedHits, setRelatedHits] = useState<RelatedHit[]>([]);
  const [relatedHasMore, setRelatedHasMore] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedPending, setRelatedPending] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Guards against a slow earlier page landing after a newer one. */
  const requestRef = useRef(0);

  const trimmed = query.trim();
  const queryActive = trimmed.length >= GLOBAL_SEARCH_MIN_CHARS;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setRelatedPending(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  /* Capture phase: React Flow panes stop propagation on pointerdown, so a
     bubble-phase outside listener never hears a click on empty canvas. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /* The field is uncontrolled and read through listeners bound to the node
     itself, not through React's delegated onChange. This bar floats over a
     canvas that stops a lot of events on their way up, and a swallowed change
     is invisible with a controlled value: React leaves the DOM alone while its
     own state has not moved, so the box keeps every letter the browser already
     inserted while the list goes on answering a four-character prefix. A
     listener on the target runs before anything can stop propagation, and
     reading `el.value` cannot disagree with what is on screen. */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const sync = () => setQuery(el.value);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('input', sync);
      el.removeEventListener('change', sync);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);

  /* Built once per model, not per keystroke: walking a large model on every
     character left the list several characters behind what was typed. */
  const searchIndex = useMemo(() => buildElementSearchIndex(model), [model]);

  const localHits = useMemo(
    () => (queryActive ? searchElementIndex(searchIndex, trimmed) : []),
    [searchIndex, trimmed, queryActive]
  );

  const loadRelatedPage = useCallback(
    (offset: number) => {
      if (!projectId || !queryActive) return;
      const requestId = requestRef.current;
      setRelatedLoading(true);
      void fetchWorkspaceSearch(queryClient, {
          projectId,
          q: trimmed,
          limit: GLOBAL_SEARCH_PAGE_SIZE,
          offset,
        })
        .then(({ elements, hasMore }) => {
          if (requestRef.current !== requestId) return;
          setRelatedHits((prev) =>
            offset === 0
              ? (elements as RelatedHit[])
              : [...prev, ...(elements as RelatedHit[])]
          );
          setRelatedHasMore(hasMore);
        })
        .catch(() => {
          if (requestRef.current !== requestId) return;
          if (offset === 0) setRelatedHits([]);
          setRelatedHasMore(false);
        })
        .finally(() => {
          if (requestRef.current === requestId) {
            setRelatedLoading(false);
            setRelatedPending(false);
          }
        });
    },
    [projectId, queryActive, trimmed, queryClient]
  );

  /* A new query starts a new list: drop what was loaded, then fetch page one. */
  useEffect(() => {
    requestRef.current += 1;
    setRelatedHits([]);
    setRelatedHasMore(false);
    setRelatedLoading(false);
    setLocalVisible(GLOBAL_SEARCH_PAGE_SIZE);
    if (!open || !queryActive) {
      setRelatedPending(false);
      return;
    }
    if (projectId) setRelatedPending(true);
    const timer = window.setTimeout(() => loadRelatedPage(0), GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, queryActive, trimmed, loadRelatedPage, projectId]);

  const canLoadMore = localVisible < localHits.length || (relatedHasMore && !relatedLoading);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!canLoadMore) return;
    if (!isNearBottom(event.currentTarget)) return;
    if (localVisible < localHits.length) {
      setLocalVisible((v) => v + GLOBAL_SEARCH_PAGE_SIZE);
      return;
    }
    if (relatedHasMore && !relatedLoading) loadRelatedPage(relatedHits.length);
  };

  const openLocal = (id: string) => {
    close();
    leaveWorkspaceOverlays({ resetTrail: false });
    requestDiagramFocus(id);
  };

  const openRelated = (hit: RelatedHit) => {
    close();
    navigate(`/projects/${hit.projectId}`, { state: { focusElementId: hit.id } });
  };

  const shownLocal = localHits.slice(0, localVisible);
  const found = shownLocal.length > 0 || relatedHits.length > 0;
  const awaitingRelated = Boolean(projectId && queryActive && (relatedPending || relatedLoading));
  const showEmpty = queryActive && !found && !awaitingRelated;

  return (
    <Box ref={rootRef} position="relative" display="flex" alignItems="center">
      <Box
        w={open ? SEARCH_INPUT_WIDTH : '0px'}
        mr={open ? '4px' : '0px'}
        overflow="hidden"
        transition="width 0.18s ease, margin 0.18s ease"
      >
        <Input
          ref={inputRef}
          {...chromeSearchInputProps}
          /* Fixed, so the reveal slides the field out instead of squeezing it. */
          w={SEARCH_INPUT_WIDTH}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          autoComplete="off"
          placeholder={t('global_search_placeholder')}
        />
      </Box>

      <ToolbarIconButton
        data-testid="toolbar-global-search"
        title={t('global_search')}
        aria-label={t('global_search')}
        active={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Search size={TOOLBAR_ICON_SIZE} />
      </ToolbarIconButton>

      {open && query.length > 0 ? (
        <Box
          position="absolute"
          top="calc(100% + 10px)"
          right="0"
          w={RESULTS_PANEL_WIDTH}
          maxW={RESULTS_PANEL_MAX_WIDTH}
          maxH={RESULTS_PANEL_MAX_HEIGHT}
          overflowY="auto"
          onScroll={handleScroll}
          p="6px"
          zIndex={1}
          {...glass.dialog}
          css={glass.scrollbar}
        >
          {!queryActive ? (
            <Text fontSize="sm" color="fg.muted" px="10px" py="14px">
              {t('global_search_min_chars', { count: GLOBAL_SEARCH_MIN_CHARS })}
            </Text>
          ) : showEmpty ? (
            <Text fontSize="sm" color="fg.muted" px="10px" py="14px">
              {t('global_search_empty')}
            </Text>
          ) : (
            <VStack align="stretch" gap="1px">
              {shownLocal.length > 0 ? (
                <Text fontSize="xs" fontWeight="600" color="fg.muted" px="10px" py="6px">
                  {t('global_search_local')}
                </Text>
              ) : null}
              {shownLocal.map((hit) => (
                <SearchResultRow
                  key={`local:${hit.id}`}
                  name={hit.name}
                  technology={hit.technology}
                  kindLabel={t(KIND_LABEL[hit.kind])}
                  meta={resultMeta([hit.parentPath, hit.domainName, projectName])}
                  onClick={() => openLocal(hit.id)}
                />
              ))}

              {projectId && (relatedHits.length > 0 || awaitingRelated) ? (
                <>
                  <Text fontSize="xs" fontWeight="600" color="fg.muted" px="10px" py="6px" mt="4px">
                    {t('global_search_related')}
                  </Text>
                  {relatedHits.map((hit) => (
                    <SearchResultRow
                      key={`related:${hit.projectId}:${hit.id}`}
                      name={hit.name}
                      technology={hit.technology}
                      kindLabel={t(KIND_LABEL[hit.type])}
                      meta={resultMeta([hit.domainName, hit.projectName])}
                      onClick={() => openRelated(hit)}
                    />
                  ))}
                  {awaitingRelated ? (
                    <SearchResultSkeletonRows
                      count={
                        relatedHits.length > 0
                          ? GLOBAL_SEARCH_MORE_SKELETON_ROWS
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
  );
}
